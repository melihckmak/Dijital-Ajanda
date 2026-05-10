# Dijital Ajanda Projesi - Katkı Sağlama Rehberi

[cite_start]Bu proje COM2010 Software Engineering dersi kapsamında geliştirilmektedir[cite: 100]. Tüm ekip üyelerinin aşağıdaki standartlara uyması zorunludur:

## 1. Branch (Dal) İsimlendirme Standartları
* [cite_start]**Frontend (Erkan):** `frontend/ozellik-adi` [cite: 106]
* [cite_start]**Backend (Bedirhan & Ceyhun):** `backend/api-adi` [cite: 105, 108]
* [cite_start]**Test/Docs (Burak):** `test/modul-adi` veya `docs/rapor-adi` [cite: 107]
* [cite_start]**AI (Melih):** `ai/model-adi` [cite: 104]

## 2. Commit Mesajları
Commit mesajları ne yapıldığını net anlatmalıdır. 
* ❌ Kötü: "kodlar güncellendi"
* ✅ İyi: "Backend görev ekleme API'si veritabanına bağlandı"

## 3. Pull Request (PR) Kuralları
Direkt `main` dalına push atmak yasaktır! [cite_start]Herkes kendi dalından PR açacak ve merge işleminden önce kodlar Test Sorumlusu (Burak) tarafından incelenecektir[cite: 107].