// The server's one forecast service, shared by every route that reads the grid, so it is fetched once.
import { forecastService, liveDeps } from './service';

export const liveForecast = forecastService(liveDeps());
