import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import './styles.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root is missing');

createRoot(el).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
