import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import * as serviceWorkerRegistration from './utils/serviceWorkerRegistration'

createRoot(document.getElementById('root')).render(<App />)

// Register service worker
serviceWorkerRegistration.register()

