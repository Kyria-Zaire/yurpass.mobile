interface WelcomeEmailProps {
  displayName: string
  loginUrl: string
}

export function welcomeEmailTemplate({ displayName, loginUrl }: WelcomeEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#F5F5F5;font-size:32px;letter-spacing:8px;margin:0;">YURPASS</h1>
    </div>
    <div style="background-color:#111111;border-radius:16px;padding:32px;border:1px solid #2A2A2A;">
      <h2 style="color:#F5F5F5;font-size:20px;margin:0 0 16px;">Bienvenue dans l'univers Yurpass</h2>
      <p style="color:#6B6B6B;font-size:16px;line-height:1.6;margin:0 0 8px;">
        ${displayName}, votre compte est maintenant vérifié.
      </p>
      <p style="color:#6B6B6B;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Vous avez désormais accès aux événements les plus exclusifs de votre ville.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${loginUrl}"
           style="background-color:#C9A84C;color:#0A0A0A;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;display:inline-block;">
          Découvrir Yurpass
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#6B6B6B;font-size:12px;margin-top:24px;">
      © ${new Date().getFullYear()} Yurpass — Sois libre. Sois léger. Sois select.
    </p>
  </div>
</body>
</html>`
}
