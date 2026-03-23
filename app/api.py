import os
import json
import numpy as np
from PIL import Image
from io import BytesIO
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# --- Setup ---
working_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(working_dir, "trained_model", "plant_disease_prediction_model.h5")

# Load model with Keras 3 compatibility fix
# The .h5 model was saved with Keras 2: patch config keys before deserialization.
import h5py
import tempfile
import shutil


def load_legacy_h5_model(path):
    """Load an h5 model saved with Keras 2 into Keras 3 by patching config."""
    import tensorflow as tf

    try:
        # First try direct loading
        return tf.keras.models.load_model(path, compile=False)
    except (TypeError, ValueError):
        pass

    # Fallback: patch the h5 file to fix known incompatibilities
    tmp = tempfile.mktemp(suffix=".h5")
    shutil.copy2(path, tmp)

    with h5py.File(tmp, "r+") as f:
        if "model_config" in f.attrs:
            config_str = f.attrs["model_config"]
            if isinstance(config_str, bytes):
                config_str = config_str.decode("utf-8")

            config = json.loads(config_str)

            def patch_config(obj):
                if isinstance(obj, dict):
                    # Remove quantization_config added by newer Keras during save
                    obj.pop("quantization_config", None)
                    # Fix InputLayer: batch_shape -> batch_input_shape
                    if obj.get("class_name") == "InputLayer":
                        cfg = obj.get("config", {})
                        if "batch_shape" in cfg and "batch_input_shape" not in cfg:
                            cfg["batch_input_shape"] = cfg.pop("batch_shape")
                        cfg.pop("optional", None)
                    for v in obj.values():
                        patch_config(v)
                elif isinstance(obj, list):
                    for item in obj:
                        patch_config(item)

            patch_config(config)
            f.attrs["model_config"] = json.dumps(config)

    import tensorflow as tf
    model = tf.keras.models.load_model(tmp, compile=False)
    os.remove(tmp)
    return model


model = load_legacy_h5_model(model_path)
with open(os.path.join(working_dir, "class_indices.json")) as f:
    class_indices = json.load(f)

# --- FastAPI App ---
app = FastAPI(title="Plant Disease Classifier")

# Mount static files
static_dir = os.path.join(working_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))


def preprocess_image(image_bytes: bytes, target_size=(224, 224)):
    """Load and preprocess an image from raw bytes."""
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img = img.resize(target_size)
    img_array = np.array(img, dtype="float32") / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Accept an image upload and return the predicted disease class."""
    contents = await file.read()
    img_array = preprocess_image(contents)
    predictions = model.predict(img_array)
    predicted_index = int(np.argmax(predictions, axis=1)[0])
    confidence = float(np.max(predictions))
    predicted_class = class_indices[str(predicted_index)]

    # Format the class name for display
    plant, condition = predicted_class.split("___", 1)
    plant = plant.replace("_", " ")
    condition = condition.replace("_", " ")

    return {
        "prediction": predicted_class,
        "plant": plant,
        "condition": condition,
        "confidence": round(confidence * 100, 2),
    }
