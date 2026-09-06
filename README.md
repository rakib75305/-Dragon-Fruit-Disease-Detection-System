# Dragon Fruit Disease Detection and Health Assessment System

A Deep Learning-based computer vision web framework developed for automated disease diagnosis and health classification of Dragon Fruit (*Hylocereus* spp.) cladodes (leaves/stems) and fruits.

---

## 📌 Project Overview

Dragon fruit cultivation is susceptible to various fungal and bacterial infections such as **Anthracnose** (*Colletotrichum gloeosporioides*), **Stem Canker** (*Neoscytalidium dimidiatum*), and **Brown Spot**. This research project implements a convolutional neural network (CNN / MobileNetV2 architecture with transfer learning) capable of real-time on-device inference using TensorFlow.js.

### Target Classes

- **Cladode / Leaf Diagnosis:**
  - Anthracnose
  - Stem Canker
  - Brown Spot
  - Healthy Stem

- **Fruit Quality Assessment:**
  - Anthracnose
  - Black Spot
  - Fresh / Healthy Fruit

---

## 🔬 Methodology & Architecture

1. **Input Normalization & Preprocessing:**
   - Input specimens are standardized to $224 \times 224 \times 3$ RGB tensors.
   - Dynamic pixel scaling $[0, 1]$ matching Keras/TensorFlow training pipelines.
2. **Inference Engine:**
   - Client-side deep learning inference powered by TensorFlow.js (TFJS).
   - High-throughput execution without external API dependency during scanning.
3. **Specimen Verification:**
   - Color spectrum distribution check to ensure valid agricultural specimens prior to classification.

---

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Machine Learning Runtime:** TensorFlow.js
- **Server:** Node.js, Express, Vite

---

## 💻 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rakib75305/dragon-fruit-disease-detection.git
   cd dragon-fruit-disease-detection
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

5. **Start production server:**
   ```bash
   npm start
   ```

---

## 👥 Contributors & Supervisors

- **Department of Computer Science and Engineering**
- Supervised by Faculty Advisory Committee
