import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import pickle
import warnings
warnings.filterwarnings('ignore')

print("1. Dijital Ajanda Eğitim Verileri Yükleniyor...")
df = pd.read_csv('dummy_dataset.csv')

print("2. Veriler Ön İşlemeden Geçiriliyor...")
# Kategorileri (Görev, Ödev, Proje, Sınav) makinenin anlayacağı sayılara çeviriyoruz
le = LabelEncoder()
df['Kategori_Encoded'] = le.fit_transform(df['Kategori'])

# Özellikler (X) ve Hedef Değişken (y - Öncelik Skoru) ayrılıyor
X = df[['Kategori_Encoded', 'Kalan_Gun', 'Zorluk_Derecesi']]
y = df['Oncelik_Skoru']

print("3. Random Forest Önceliklendirme Modeli Eğitiliyor...")
# Hızlı yanıt vermesi için (Rapordaki risk yönetimi FR-NFR-04 gereği) hafif bir model
model = RandomForestRegressor(n_estimators=20, random_state=42)
model.fit(X, y)

print("4. Test Ediliyor: 3 gün kalmış, Zorluk 4 olan bir PROJE...")
# Test tahmini
test_kategori = le.transform(['Proje'])[0]
test_verisi = [[test_kategori, 3, 4]]
tahmin = model.predict(test_verisi)

print("-" * 40)
print(f"Yapay Zeka Öncelik Önerisi: {tahmin[0]:.2f} / 100")
print("-" * 40)

# İleride Backend'in (Bedirhan/Ceyhun) kullanabilmesi için modeli ve encoder'ı kaydediyoruz
with open('priority_model.pkl', 'wb') as f:
    pickle.dump(model, f)
with open('label_encoder.pkl', 'wb') as f:
    pickle.dump(le, f)
    
print("Model başarıyla 'priority_model.pkl' olarak kaydedildi!")