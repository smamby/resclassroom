import json, os, time, urllib.request
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
state = json.load(open(os.path.join(HERE, 'state.json')))
BASE = 'http://localhost:3000'
TITLE = 'Taller E2E de Capacitacion'
DATE = '2026-08-11'

results = []

def check(name, ok):
    results.append((name, ok))
    print(('PASS' if ok else 'FAIL') + ' - ' + name)

def warm_up(base, budget=180):
    # El server abre el puerto apenas escucha, pero su primera conexion a Mongo
    # puede tardar decenas de segundos (cold start de Atlas). Probamos /bookings
    # hasta que responda 200 antes de abrir el navegador.
    deadline = time.time() + budget
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(base + '/bookings', timeout=10) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(3)
    return False

def wait_calendar(page, budget=60):
    # Primer arranque del server puede tardar (cold start de Mongo): reintenta
    # sin recargar hasta que la cadena de fetches inicial resuelva.
    deadline = time.time() + budget
    while time.time() < deadline:
        try:
            page.wait_for_selector('.calendar-day', timeout=max(1, deadline - time.time()))
            return True
        except Exception:
            continue
    return False

def login(page, email, password):
    page.click('#btnLogin')
    page.wait_for_selector('#loginForm', timeout=10000)
    page.fill('#loginEmail', email)
    page.fill('#loginPassword', password)
    page.click('#loginForm button[type="submit"]')
    page.wait_for_selector('#menu:not([hidden])', timeout=15000)
    wait_calendar(page)

def close_aviso(page):
    btn = page.query_selector('#avisoCloseBtn')
    if btn:
        btn.click()
        page.wait_for_timeout(300)

def logout(page):
    page.click('#btnLogout')
    page.wait_for_selector('#btnLogin', timeout=15000)

def open_menu(page, action):
    page.click('.menu-btn')
    page.click('[data-action="%s"]' % action)

if not warm_up(BASE):
    raise SystemExit('FATAL: el server no respondio /bookings tras el warm-up')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 2000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    page.goto(BASE, wait_until='domcontentloaded')
    if not wait_calendar(page):
        raise SystemExit('FATAL: el calendario no renderizo en el arranque')

    # ---- Instructor: crea borrador ----
    login(page, state['emails']['instructor'], state['password'])
    check('login instructor', True)

    page.click('#btnNewReservation')
    page.wait_for_selector('#courseModal', timeout=10000)
    check('FAB abre modal de curso', 'Nuevo Curso' in page.text_content('#courseModal'))

    page.fill('#courseTitle', TITLE)
    page.fill('#courseType', 'taller')
    page.fill('#courseStartDate', DATE)
    page.fill('#courseEndDate', '2026-08-31')
    page.select_option('.block-workspace', value=state['workspaceId'])
    page.eval_on_selector('#courseModal input[name="block-days"][value="2"]', 'el => el.click()')
    page.click('#saveDraft')
    page.wait_for_selector('#avisoCloseBtn', timeout=15000)
    check('borrador guardado', 'Borrador guardado' in page.text_content('#registerModal'))
    close_aviso(page)

    # ---- Enviar a votación desde la vista Cursos ----
    open_menu(page, 'cursos')
    page.wait_for_selector('#cursosView', timeout=10000)
    card = page.locator('#cursosList .course-card', has_text=TITLE).first
    card.wait_for(timeout=10000)
    check('borrador visible en Mis borradores', True)
    card.get_by_role('button', name='Enviar a votación').click()
    page.wait_for_selector('#avisoCloseBtn', timeout=15000)
    check('enviado a votacion', 'Enviado a votación' in page.text_content('#registerModal'))
    close_aviso(page)
    page.click('#cursosView .overlay-head .btn-secondary')  # Cerrar
    page.wait_for_selector('#cursosView', state='detached', timeout=10000)

    # ---- Subco: badge + votación + calendario punteado ----
    logout(page)
    check('logout instructor', True)

    login(page, state['emails']['subco'], state['password'])
    check('login subco', True)
    page.click('.menu-btn')
    badge = page.locator('[data-vote-badge]')
    badge.wait_for(state='visible', timeout=10000)
    count = int(badge.inner_text())
    check('badge de votación pendiente >= 1', count >= 1)
    page.click('[data-action="votar"]')
    page.wait_for_selector('#votarView', timeout=10000)
    vcard = page.locator('#votarList .course-card', has_text=TITLE).first
    vcard.wait_for(timeout=10000)
    vcard.get_by_role('button', name='A favor').click()
    page.wait_for_selector('#avisoCloseBtn', timeout=15000)
    check('voto registrado', 'Voto registrado' in page.text_content('#registerModal'))
    close_aviso(page)
    vcard2 = page.locator('#votarList .course-card', has_text=TITLE).first
    vcard2.wait_for(timeout=10000)
    check('voto reflejado en la card', 'Tu voto: A favor' in vcard2.inner_text())
    page.wait_for_function(
        "() => { const b = document.querySelector('[data-vote-badge]'); return b && b.hidden === true && b.textContent === '0'; }",
        timeout=10000)
    check('badge oculto tras votar', True)
    page.click('#votarView .overlay-head .btn-secondary')  # Cerrar
    page.wait_for_selector('#votarView', state='detached', timeout=10000)

    day = page.locator(".calendar-day[data-date='%s']" % DATE)
    day.wait_for(timeout=10000)
    day.locator('.activity-dot').first.wait_for(state='visible', timeout=10000)
    dot_styles = [d.get_attribute('style') or '' for d in day.locator('.activity-dot').all()]
    check('dot punteado para propuesta pending', any('dashed' in s for s in dot_styles))
    day.click()
    pend = page.locator('#dayActivities .activity-card', has_text=TITLE)
    pend.wait_for(timeout=10000)
    tag_text = pend.locator('.pending-tag').inner_text()
    check('tag Propuesta en votación', tag_text.upper() == 'PROPUESTA EN VOTACIÓN')
    check('card pending sin editar/eliminar', pend.locator('.icon-btn').count() == 0)

    # ---- Visitante: no ve la propuesta ----
    logout(page)
    check('logout subco', True)
    day2 = page.locator(".calendar-day[data-date='%s']" % DATE)
    day2.wait_for(timeout=10000)
    day2.click()
    page.wait_for_timeout(600)
    body = page.locator('#dayActivities').inner_text()
    check('visitante NO ve la propuesta', TITLE not in body and page.locator('#dayActivities .activity-card-pending').count() == 0)

    # ---- Deep-link ?votar=<id> (subco) ----
    login(page, state['emails']['subco'], state['password'])
    page.goto(BASE + '/?votar=x', wait_until='domcontentloaded')
    page.wait_for_selector('#votarView', timeout=15000)
    check('deep-link ?votar abre la vista de votación', True)

    check('sin errores de JS en consola', len(errors) == 0)

    browser.close()

print('RESULTADO E2E:', 'ALL PASS' if all(ok for _, ok in results) else 'HAY FALLOS')
for name, ok in results:
    print(('  PASS ' if ok else '  FAIL ') + name)
import sys
sys.exit(0 if all(ok for _, ok in results) else 1)
