function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function welcomeHtml(displayName: string): string {
  const name = esc((displayName || "Merhaba").trim() || "Merhaba");
  return `<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f9f9f9;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" cellpadding="24" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #eee;">
<tr><td>
<h1 style="color:#800000;margin:0 0 12px;">Dijital Ajanda</h1>
<p style="color:#333;font-size:16px;line-height:1.5;">${name}, aramıza hoş geldin.</p>
<p style="color:#666;font-size:15px;line-height:1.6;">Görevlerini ve günlük notlarını tek yerden yönet; takımınla senkron kal. İyi çalışmalar.</p>
<p style="margin-top:24px;color:#00AEEF;font-weight:bold;">— Dijital Ajanda</p>
</td></tr></table></td></tr></table></body></html>`;
}

export type TaskRow = {
  title: string;
  deadline: string;
  category: string | null;
};

export function reminderDigestHtml(tasks: TaskRow[], from: string, to: string): string {
  const rows = [...tasks]
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title))
    .map((t) => {
      const title = esc(t.title);
      const cat = esc(t.category ?? "—");
      const dl = esc(t.deadline);
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;"><strong>${title}</strong><br/><span style="color:#666;font-size:13px;">${cat} · son tarih ${dl}</span></td></tr>`;
    })
    .join("");
  return `<html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f9f9f9;padding:24px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="560" cellpadding="24" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #eee;">
<tr><td>
<h1 style="color:#800000;margin:0 0 8px;">Yaklaşan görevler</h1>
<p style="color:#666;margin:0 0 16px;">${esc(from)} – ${esc(to)} aralığında tamamlanmamış kayıtların:</p>
<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin-top:20px;color:#00AEEF;font-weight:bold;">— Dijital Ajanda</p>
</td></tr></table></td></tr></table></body></html>`;
}
