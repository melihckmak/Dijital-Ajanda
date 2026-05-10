from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="Dijital Ajanda Yapay Zeka Servisi")

print("Modeller Yükleniyor...")
# Daha önce eğittiğimiz modelleri okuyoruz
with open('priority_model.pkl', 'rb') as f:
    model = pickle.load(f)
with open('label_encoder.pkl', 'rb') as f:
    le = pickle.load(f)

# Backend'den (Bedirhan/Ceyhun) bize gelecek verinin şablonu
class TaskData(BaseModel):
    kategori: str  # Örn: 'Sinav', 'Proje', 'Odev', 'Gorev'
    kalan_gun: int
    zorluk_derecesi: int

@app.post("/predict_priority")
def predict_priority(task: TaskData):
    try:
        # 1. Gelen kategoriyi modelin anladığı sayıya çevir
        kategori_encoded = le.transform([task.kategori])[0]
        
        # 2. Tahmin verisini hazırla
        test_verisi = [[kategori_encoded, task.kalan_gun, task.zorluk_derecesi]]
        
        # 3. Modelden tahmini al
        tahmin = model.predict(test_verisi)
        
        # 4. Skoru backend'e gönder
        return {
            "durum": "basarili",
            "kategori": task.kategori,
            "oncelik_skoru": round(float(tahmin[0]), 2)
        }
    except Exception as e:
        return {"durum": "hata", "mesaj": str(e)}