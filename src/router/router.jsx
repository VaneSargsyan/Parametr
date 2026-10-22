import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';
import { recoveryDestination } from '../features/admin/recovery';

// Default dashboard recovery emails may redirect to Site URL (/). Route before mounting auth.
const recoveryTarget = recoveryDestination(window.location);
if (recoveryTarget) window.history.replaceState(window.history.state, '', recoveryTarget);

export const router = createBrowserRouter(routes);
