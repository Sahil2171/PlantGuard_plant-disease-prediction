// =============================================
// Plant Disease Classifier — Frontend Logic
// =============================================

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropContent = document.getElementById('dropContent');
const previewArea = document.getElementById('previewArea');
const previewImage = document.getElementById('previewImage');
const removeBtn = document.getElementById('removeBtn');
const classifyBtn = document.getElementById('classifyBtn');
const btnText = classifyBtn.querySelector('.btn-text');
const btnLoader = document.getElementById('btnLoader');
const resultSection = document.getElementById('resultSection');
const resultPlant = document.getElementById('resultPlant');
const resultCondition = document.getElementById('resultCondition');
const resultConfidence = document.getElementById('resultConfidence');
const confidenceBar = document.getElementById('confidenceBar');
const resultIcon = document.getElementById('resultIcon');
const plantsGrid = document.getElementById('plantsGrid');

let selectedFile = null;

// ---- Supported plants (rendered as chips) ----
const plants = [
    { name: 'Apple', emoji: '🍎' },
    { name: 'Blueberry', emoji: '🫐' },
    { name: 'Cherry', emoji: '🍒' },
    { name: 'Corn', emoji: '🌽' },
    { name: 'Grape', emoji: '🍇' },
    { name: 'Orange', emoji: '🍊' },
    { name: 'Peach', emoji: '🍑' },
    { name: 'Pepper', emoji: '🌶️' },
    { name: 'Potato', emoji: '🥔' },
    { name: 'Raspberry', emoji: '🫐' },
    { name: 'Soybean', emoji: '🫘' },
    { name: 'Squash', emoji: '🎃' },
    { name: 'Strawberry', emoji: '🍓' },
    { name: 'Tomato', emoji: '🍅' },
];

function renderPlants() {
    plantsGrid.innerHTML = plants
        .map(
            (p) =>
                `<div class="plant-chip">
                    <span class="plant-emoji">${p.emoji}</span>
                    <span>${p.name}</span>
                </div>`
        )
        .join('');
}

// ---- Drag & Drop ----
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length) handleFile(files[0]);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
});

// ---- File Handling ----
function handleFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        alert('Please upload a JPG, JPEG, or PNG image.');
        return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        dropContent.classList.add('hidden');
        previewArea.classList.remove('hidden');
        resultSection.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

// ---- Remove Image ----
removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetUpload();
});

function resetUpload() {
    selectedFile = null;
    fileInput.value = '';
    previewImage.src = '';
    previewArea.classList.add('hidden');
    dropContent.classList.remove('hidden');
    resultSection.classList.add('hidden');
}

// ---- Classify ----
classifyBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // Show loading state
    classifyBtn.disabled = true;
    btnText.textContent = 'Analyzing…';
    btnLoader.classList.remove('hidden');
    resultSection.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch('/predict', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Prediction failed');

        const data = await response.json();
        showResult(data);
    } catch (err) {
        alert('Something went wrong. Please ensure the server is running and try again.');
        console.error(err);
    } finally {
        classifyBtn.disabled = false;
        btnText.textContent = 'Classify Disease';
        btnLoader.classList.add('hidden');
    }
});

// ---- Display Result ----
function showResult(data) {
    resultPlant.textContent = data.plant;

    const isHealthy = data.condition.toLowerCase() === 'healthy';
    resultCondition.textContent = data.condition;
    resultCondition.style.color = isHealthy ? 'var(--accent)' : 'var(--danger)';
    resultIcon.textContent = isHealthy ? '✅' : '⚠️';

    resultConfidence.textContent = data.confidence + '%';

    // Animate confidence bar
    confidenceBar.style.width = '0';
    resultSection.classList.remove('hidden');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            confidenceBar.style.width = data.confidence + '%';
        });
    });
}

// ---- Init ----
renderPlants();
