interface ResetPasswordEmailProps {
  displayName: string
  resetUrl: string
}

export function resetPasswordEmailTemplate({ displayName, resetUrl }: ResetPasswordEmailProps): string {
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
      <h2 style="color:#F5F5F5;font-size:20px;margin:0 0 16px;">Réinitialisation du mot de passe</h2>
      <p style="color:#6B6B6B;font-size:16px;line-height:1.6;margin:0 0 8px;">
        Bonjour ${displayName},
      </p>
      <p style="color:#6B6B6B;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Vous avez demandé la réinitialisation de votre mot de passe.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
           style="background-color:#8B5CF6;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;display:inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color:#6B6B6B;font-size:13px;line-height:1.5;margin:0;">
        Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et votre mot de passe restera inchangé.
      </p>
    </div>
    <p style="text-align:center;color:#6B6B6B;font-size:12px;margin-top:24px;">
      © ${new Date().getFullYear()} Yurpass — Sois libre. Sois léger. Sois select.
    </p>
  </div>
</body>
</html>`
}
