import './polyfills';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { loadTheme, applyTheme } from './theme/theme-toggle.component';

applyTheme(loadTheme());

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
