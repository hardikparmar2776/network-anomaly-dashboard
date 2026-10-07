import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib

# 1. Generate synthetic dataset matching paper features (UNSW-NB15 structure)
np.random.seed(42)
n_samples = 1000

data = pd.DataFrame({
    'Sttl': np.random.randint(30, 255, size=n_samples),
    'Proto': np.random.choice([6, 17, 1], size=n_samples), # 6: TCP, 17: UDP, 1: ICMP
    'Sload': np.random.uniform(100.0, 100000.0, size=n_samples),
    'Dload': np.random.uniform(50.0, 50000.0, size=n_samples),
    'Spkts': np.random.randint(1, 100, size=n_samples),
    'Dpkts': np.random.randint(1, 100, size=n_samples),
})

# Create synthetic labels (0: Normal, 1: Anomaly) based on simple traffic spikes
# High Sload + ICMP/UDP or extreme TTLs flagged as anomalies
data['Label'] = np.where((data['Sload'] > 80000) | (data['Sttl'] > 240) | (data['Proto'] == 1), 1, 0)

# Save synthetic historical dataset
data.to_csv('UNSW_NB15_sample.csv', index=False)
print("Saved UNSW_NB15_sample.csv")

# 2. Separate Features (X) and Target (y)
features = ['Sttl', 'Proto', 'Sload', 'Dload', 'Spkts', 'Dpkts']
X = data[features]
y = data['Label']

# 3. Train Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. Train Random Forest Classifier
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train)

# 5. Evaluate Model
y_pred = clf.predict(X_test)
print("\n--- Model Evaluation ---")
print(f"Accuracy: {accuracy_score(y_test, y_pred) * 100:.2f}%")
print(classification_report(y_test, y_pred))

# 6. Export Trained Model & Stream Simulation File
joblib.dump(clf, 'model.joblib')
print("Model saved as model.joblib")

# Create a small CSV simulating incoming real-time traffic
stream_data = data.sample(30, random_state=10).drop(columns=['Label'])
stream_data.to_csv('new_network_traffic.csv', index=False)
print("Saved new_network_traffic.csv for real-time streaming simulation.\n")