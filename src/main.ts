import './style.css';
import { App } from './game/App';

const root = document.getElementById('app')!;
const app = new App(root);
app.boot().catch((e) => { console.error(e); root.insertAdjacentHTML('beforeend', `<pre class="nx-fatal">${String(e?.stack ?? e)}</pre>`); });
