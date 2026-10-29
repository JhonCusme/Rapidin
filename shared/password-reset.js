/* ==========================================================================
   RAPIDIN - RECUPERAR CONTRASEÑA (comercios, repartidores y admin)
   Autónomo: agrega el enlace "¿Olvidaste tu contraseña?" bajo el login y una ventana propia
   para pedir el correo y, al volver con ?reset=TOKEN, para crear la contraseña nueva.
   ========================================================================== */
(function () {
  const form = document.querySelector('form[id^="gate-"][id$="-form-login"]');
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');
  if (!form && !resetToken) return;

  const API = `${window.RAPIDIN_API_BASE}/api/auth`;
  const css = {
    overlay: 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.78);display:none;align-items:center;justify-content:center;padding:1rem;',
    card: 'background:var(--bg-card,#161F30);border:1px solid var(--border-color,#243049);border-radius:16px;max-width:400px;width:100%;padding:1.6rem;color:var(--text-primary,#fff);font-family:inherit;',
    input: 'width:100%;padding:.8rem;border-radius:10px;border:1px solid var(--border-color,#243049);background:var(--bg-main,#0B0F19);color:var(--text-primary,#fff);font-size:16px;margin:.35rem 0 .9rem;',
    btn: 'width:100%;padding:.85rem;border-radius:999px;border:none;background:#8B5CF6;color:#fff;font-weight:800;font-size:.95rem;cursor:pointer;',
    ghost: 'background:none;border:none;color:var(--text-secondary,#94A3B8);cursor:pointer;margin-top:.8rem;width:100%;font-size:.85rem;',
    msg: 'font-size:.85rem;margin:.2rem 0 .8rem;min-height:1.1em;'
  };

  const overlay = document.createElement('div');
  overlay.style.cssText = css.overlay;
  overlay.innerHTML = `<div style="${css.card}">
    <div id="pr-request">
      <h2 style="font-size:1.2rem;margin-bottom:.4rem;">Recuperar contraseña</h2>
      <p style="font-size:.85rem;color:var(--text-secondary,#94A3B8);margin-bottom:1rem;">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
      <label style="font-size:.8rem;font-weight:700;">Correo electrónico</label>
      <input id="pr-email" type="email" autocomplete="email" style="${css.input}">
      <div id="pr-request-msg" style="${css.msg}"></div>
      <button id="pr-send" style="${css.btn}">Enviar enlace</button>
      <button id="pr-close" style="${css.ghost}">Volver al inicio de sesión</button>
    </div>
    <div id="pr-reset" style="display:none;">
      <h2 style="font-size:1.2rem;margin-bottom:.4rem;">Crea tu contraseña nueva</h2>
      <label style="font-size:.8rem;font-weight:700;">Contraseña nueva (mínimo 6 caracteres)</label>
      <input id="pr-pass1" type="password" autocomplete="new-password" style="${css.input}">
      <label style="font-size:.8rem;font-weight:700;">Repite la contraseña</label>
      <input id="pr-pass2" type="password" autocomplete="new-password" style="${css.input}">
      <div id="pr-reset-msg" style="${css.msg}"></div>
      <button id="pr-save" style="${css.btn}">Guardar contraseña</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const $ = (id) => overlay.querySelector('#' + id);
  const say = (el, text, ok) => { el.textContent = text; el.style.color = ok ? '#10B981' : '#EF4444'; };
  const post = async (path, body) => {
    try {
      const res = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return await res.json();
    } catch (e) { return { success: false, message: 'No hay conexión con el servidor.' }; }
  };

  if (form) {
    const link = document.createElement('button');
    link.type = 'button';
    link.textContent = '¿Olvidaste tu contraseña?';
    link.style.cssText = 'background:none;border:none;color:var(--text-secondary,#94A3B8);cursor:pointer;font-size:.85rem;text-decoration:underline;margin-top:.9rem;width:100%;';
    link.addEventListener('click', () => {
      $('pr-request').style.display = 'block'; $('pr-reset').style.display = 'none';
      const typed = form.querySelector('input[type="email"]');
      if (typed && typed.value) $('pr-email').value = typed.value;
      overlay.style.display = 'flex';
      $('pr-email').focus();
    });
    form.insertAdjacentElement('afterend', link);
  }

  $('pr-close').addEventListener('click', () => { overlay.style.display = 'none'; });
  $('pr-send').addEventListener('click', async () => {
    const email = $('pr-email').value.trim();
    if (!email) return say($('pr-request-msg'), 'Escribe tu correo.', false);
    $('pr-send').disabled = true;
    const res = await post('forgot-password', { email });
    $('pr-send').disabled = false;
    say($('pr-request-msg'), res.message || 'Revisa tu correo.', !!res.success);
  });

  if (resetToken) {
    $('pr-request').style.display = 'none'; $('pr-reset').style.display = 'block';
    overlay.style.display = 'flex';
    $('pr-save').addEventListener('click', async () => {
      const p1 = $('pr-pass1').value, p2 = $('pr-pass2').value;
      if (p1.length < 6) return say($('pr-reset-msg'), 'Usa al menos 6 caracteres.', false);
      if (p1 !== p2) return say($('pr-reset-msg'), 'Las contraseñas no coinciden.', false);
      $('pr-save').disabled = true;
      const res = await post('reset-password', { token: resetToken, password: p1 });
      $('pr-save').disabled = false;
      if (res.success) {
        say($('pr-reset-msg'), res.message, true);
        history.replaceState({}, '', window.location.pathname);
        setTimeout(() => { overlay.style.display = 'none'; }, 1800);
      } else {
        say($('pr-reset-msg'), res.message || 'No se pudo cambiar la contraseña.', false);
      }
    });
  }
})();
