import json

def get_engineering_templates():
    """
    Kullanıcıların dijital ajandaya tek tıkla ekleyebileceği yapay zeka destekli 
    hazır mühendislik ve yazılım proje şablonları.
    """
    templates = {
        "Genel Yazılım Projesi": [
            {"gorev": "Veritabanı şeması tasarımı", "kalan_gun": 5, "zorluk": 4, "kategori": "Proje"},
            {"gorev": "API uç noktalarının (Endpoint) yazılması", "kalan_gun": 10, "zorluk": 3, "kategori": "Gorev"}
        ],
        "Otonom Kara Aracı (İKA) Geliştirme": [
            {"gorev": "Ağır ROS navigasyon paketleri yerine reaktif Sonlu Durum Makinesi (FSM) kodlaması", "kalan_gun": 15, "zorluk": 5, "kategori": "Proje"},
            {"gorev": "Direksiyon sistemi yerine diferansiyel (tank tipi) sürüş dinamiği testleri", "kalan_gun": 12, "zorluk": 4, "kategori": "Gorev"},
            {"gorev": "Motor sürücü kartlarının entegrasyonu ve telemetri yayını", "kalan_gun": 7, "zorluk": 3, "kategori": "Odev"}
        ]
    }
    return templates

if __name__ == "__main__":
    print("Mevcut AI Proje Şablonları Yüklendi:\n")
    print(json.dumps(get_engineering_templates(), indent=4, ensure_ascii=False))