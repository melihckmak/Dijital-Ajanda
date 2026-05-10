import requests
import json

# Bu test scripti, Test Sorumlusu tarafından AI API'sini doğrulamak için kullanılacaktır.

url = "http://127.0.0.1:8000/predict_priority"

# Backend'den gelecek örnek bir görev JSON verisi
ornek_gorev = {
    "kategori": "Proje",
    "kalan_gun": 3,
    "zorluk_derecesi": 4
}

print("Yapay Zeka API'sine istek atılıyor...")

try:
    response = requests.post(url, json=ornek_gorev)
    if response.status_code == 200:
        sonuc = response.json()
        print("\n--- BAŞARILI YANIT ---")
        print(f"Kategori: {sonuc['kategori']}")
        print(f"Hesaplanan Öncelik Skoru: {sonuc['oncelik_skoru']} / 100")
        print("----------------------\n")
    else:
        print(f"Hata Kodu: {response.status_code}")
except Exception as e:
    print(f"Bağlantı Hatası! Lütfen önce 'uvicorn api:app --reload' ile sunucuyu başlatın.\nDetay: {e}")