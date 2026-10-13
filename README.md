# Aether — Network Anomaly Intelligence

## Overview

Aether is a machine-learning-based network anomaly detection application designed to analyze network traffic datasets and identify potentially suspicious activity. It provides an interactive dashboard where users can upload CSV files, view analysis results, explore anomalous records, and visualize network traffic patterns.

The application uses a React-based frontend, a FastAPI backend, and an Isolation Forest machine learning model to perform anomaly screening on uploaded network traffic data.

## Features

- **Network Traffic Analysis:** Upload CSV datasets for automated anomaly screening.
- **Anomaly Detection:** Identify records that deviate from patterns learned by the trained machine learning model.
- **Interactive Dashboard:** View total records, detected anomalies, normal records, and anomaly rates.
- **Anomaly Explorer:** Inspect records flagged by the model.
- **Analytics Dashboard:** Visualize traffic summaries, protocol distributions, and analysis results.
- **Report History:** Review previously saved analysis summaries.
- **Data Validation:** Validate uploaded CSV files before processing.
- **REST API Integration:** Connect the frontend and backend through FastAPI endpoints.

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- Recharts
- Lucide React
- CSS

**Backend**
- Python
- FastAPI
- pandas
- NumPy
- scikit-learn
- joblib

**Machine Learning**
- Isolation Forest
- Numerical and categorical data preprocessing
- Missing-value imputation
- One-hot encoding

## Project Structure

```text
Aether/
├── backend/
│   ├── main.py
│   ├── train_model.py
│   ├── test_backend.py
│   └── models/
│       └── aether_model.joblib
├── data/
│   ├── UNSW_NB15_training-set.csv
│   ├── UNSW_NB15_testing-set.csv
│   ├── aether_test_dataset.csv
│   ├── aether_unsw_schema_test.csv
│   ├── UNSW_NB15_new_values.csv
│   └── UNSW_NB15_alternate_dataset.csv
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Analytics.jsx
│   │   │   ├── Analytics.css
│   │   │   ├── AnomalyExplorer.jsx
│   │   │   ├── AnomalyExplorer.css
│   │   │   ├── AuthModal.jsx
│   │   │   ├── AuthModal.css
│   │   │   ├── ReportHistory.jsx
│   │   │   └── ReportHistory.css
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## How It Works

1. The user uploads a network traffic CSV file through the Aether frontend.
2. The frontend sends the uploaded file to the FastAPI backend.
3. The backend validates the file and prepares the required input features.
4. The trained machine learning pipeline processes the network traffic records.
5. The model classifies records as normal or anomalous.
6. The backend returns summary metrics and flagged records.
7. The frontend displays the results through dashboard cards, charts, and the anomaly explorer.

## Machine Learning Model

Aether uses the Isolation Forest algorithm for unsupervised anomaly detection. The model learns patterns from normal network traffic and identifies records that differ from those patterns.

The training pipeline uses the UNSW-NB15 training and testing datasets. It preprocesses numerical and categorical features, handles missing values, and applies one-hot encoding before training the model.

The trained model and preprocessing pipeline are saved in `backend/models/aether_model.joblib` and loaded by the backend for analysis.

The model's predictions are interpreted as follows:

- `-1`: Anomalous record
- `1`: Normal record

An anomaly score represents the model's assessment of how unusual a record is. It is not a calibrated probability of an attack.

## Installation and Setup

### Prerequisites

- Python 3.10 or newer recommended
- Node.js and npm
- Required project datasets
- A trained model file or the ability to train one

### 1. Set Up the Backend

Open a terminal in the project directory and navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate the environment in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
python -m pip install fastapi uvicorn pandas numpy scikit-learn joblib python-multipart
```

### 2. Train the Model

Ensure that the required training and testing datasets are available in the `data/` directory at the paths expected by the training script.

From the `backend/` directory, run:

```bash
python train_model.py
```

The trained model will be saved to:

```text
backend/models/aether_model.joblib
```

If a compatible trained model already exists, this step can be skipped.

### 3. Start the Backend Server

From the `backend/` directory, run:

```bash
uvicorn main:app --reload
```

The backend API will be available at:

`http://127.0.0.1:8000`

Interactive API documentation is available at:

`http://127.0.0.1:8000/docs`

### 4. Set Up the Frontend

Open a second terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL provided by Vite, usually:

`http://localhost:5173`

Keep both the backend and frontend servers running while using the application.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Returns basic API information |
| GET | `/api/health` | Checks backend health and model availability |
| POST | `/api/analyze-csv` | Accepts a CSV file and returns anomaly analysis results |

The analysis response includes summary information such as the total number of records, detected anomalies, normal records, anomaly rate, traffic summaries, and flagged records.

## Testing

The backend includes tests in `backend/test_backend.py`.

Install the testing dependencies if needed:

```bash
python -m pip install pytest httpx
```

Run the tests from the `backend/` directory:

```bash
python -m pytest -v
```

For a manual test, start both servers, open the dashboard, upload a compatible CSV file, and verify that the analysis results and visualizations appear correctly.

## Dataset Information

Aether uses the UNSW-NB15 dataset for model training and evaluation.

The expected dataset files are:

- `data/UNSW_NB15_training-set.csv`
- `data/UNSW_NB15_testing-set.csv`

Additional datasets can be used for interface testing and robustness checks. Modified or synthetic datasets should not be treated as genuine network traffic, and their labels may not accurately represent their modified features.

## Limitations

- Aether analyzes uploaded CSV files and does not independently capture live network traffic.
- Detection results depend on the quality of the input data and the trained model.
- An anomalous record is not necessarily malicious.
- Missing or incompatible features may affect analysis quality.
- Anomaly scores should not be interpreted as attack probabilities.
- The API returns a limited list of flagged records per analysis response.

## Future Enhancements

- User authentication and role-based access control.
- Exportable PDF analysis reports.
- Improved dataset validation and data-quality warnings.
- Model version tracking and performance monitoring.
- Analyst feedback and anomaly investigation workflows.
- Secure integration with live network telemetry.
- Support for additional anomaly detection algorithms.

## Disclaimer

Aether is intended for educational, research, and analyst-assistance purposes. Its results should be interpreted carefully and validated using additional evidence before making security-related decisions.
