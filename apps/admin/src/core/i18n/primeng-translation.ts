import {
  DestroyRef,
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { TranslocoService, type Translation } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { catchError, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type Translate = (key: string) => string;

/** Maps our catalog keys onto PrimeNG's built-in table, paginator, and dialog labels. */
export function buildPrimeNgTranslation(translate: Translate): Translation {
  return {
    emptyMessage: translate('common.table.empty'),
    emptyFilterMessage: translate('common.table.emptyFilter'),
    clear: translate('common.filter.clear'),
    apply: translate('common.filter.apply'),
    matchAll: translate('common.filter.matchAll'),
    matchAny: translate('common.filter.matchAny'),
    addRule: translate('common.filter.addRule'),
    removeRule: translate('common.filter.removeRule'),
    accept: translate('common.dialog.accept'),
    reject: translate('common.dialog.reject'),
    aria: {
      pageLabel: translate('common.paginator.page'),
      firstPageLabel: translate('common.paginator.firstPage'),
      lastPageLabel: translate('common.paginator.lastPage'),
      nextPageLabel: translate('common.paginator.nextPage'),
      prevPageLabel: translate('common.paginator.previousPage'),
      rowsPerPageLabel: translate('common.paginator.rowsPerPage'),
      jumpToPageDropdownLabel: translate('common.paginator.jumpToPage'),
      jumpToPageInputLabel: translate('common.paginator.jumpToPageInput'),
    },
  };
}

/**
 * Keeps PrimeNG's built-in labels in sync with the active Transloco catalog.
 * The translations are loaded before the labels are read so the first paint
 * does not fall back to keys.
 */
export function providePrimeNgTranslations(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const transloco = inject(TranslocoService);
    const primeng = inject(PrimeNG);
    const destroyRef = inject(DestroyRef);

    const syncLabels = (): void => {
      primeng.setTranslation(
        buildPrimeNgTranslation((key) => transloco.translate(key)),
      );
    };

    transloco.langChanges$
      .pipe(
        switchMap((lang) =>
          transloco.load(lang).pipe(catchError(() => of<Translation>({}))),
        ),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(() => syncLabels());
  });
}
