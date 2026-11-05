import { Component, forwardRef, input, signal, Pipe, PipeTransform } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Formatea un número al estilo colombiano: punto como separador de miles y coma decimal.
 * Ej.: 2240000.03 → "2.240.000,03"; 1500 → "1.500". Los decimales solo se muestran si existen.
 */
export function formatCop(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  const negative = value < 0;
  const [int, dec] = Math.abs(value).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = dec.replace(/0+$/, '');
  return `${negative ? '-' : ''}${grouped}${decimals ? ',' + decimals : ''}`;
}

/** Uso en plantillas: `$ {{ monto | cop }}`. */
@Pipe({ name: 'cop' })
export class CopPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatCop(value ?? 0);
  }
}

/**
 * Campo de dinero: mientras se escribe muestra el formato de peso colombiano
 * (miles con punto, decimales con coma, máximo 2) y entrega un `number` al formulario.
 */
@Component({
  selector: 'app-money',
  template: `
    <span class="sym" aria-hidden="true">$</span>
    <input #el type="text" inputmode="decimal" autocomplete="off"
           [value]="text()" [placeholder]="placeholder()" [attr.aria-label]="ariaLabel() || null"
           [disabled]="disabled()" (input)="onInput(el)" (blur)="onTouched()" />
  `,
  styles: `
    :host { display: block; position: relative; }
    .sym { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; pointer-events: none; }
    input { width: 100%; padding-left: 28px; font-variant-numeric: tabular-nums; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInput), multi: true }],
})
export class MoneyInput implements ControlValueAccessor {
  placeholder = input('0');
  ariaLabel = input('');

  protected text = signal('');
  protected disabled = signal(false);

  private onChange: (v: number | null) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: number | null): void { this.text.set(formatCop(v)); }
  registerOnChange(fn: (v: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  protected onInput(el: HTMLInputElement) {
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    // Cuántos caracteres significativos (dígitos o coma) hay antes del cursor.
    const significantBefore = raw.slice(0, caret).replace(/[^\d,]/g, '').length;

    const { text, value } = this.parse(raw);
    el.value = text;
    this.text.set(text);

    let pos = 0;
    let count = 0;
    while (pos < text.length && count < significantBefore) {
      if (/[\d,]/.test(text[pos])) count++;
      pos++;
    }
    el.setSelectionRange(pos, pos);

    this.onChange(value);
  }

  private parse(raw: string): { text: string; value: number | null } {
    // El punto es separador de miles (se ignora al escribir); la coma es el decimal.
    const clean = raw.replace(/[^\d,]/g, '');
    const comma = clean.indexOf(',');
    let int = (comma >= 0 ? clean.slice(0, comma) : clean).replace(/^0+(?=\d)/, '').slice(0, 12);
    const dec = comma >= 0 ? clean.slice(comma + 1).replace(/,/g, '').slice(0, 2) : null;

    if (int === '' && dec === null) return { text: '', value: null };
    if (int === '') int = '0';

    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const text = dec === null ? grouped : `${grouped},${dec}`;
    return { text, value: Number(dec ? `${int}.${dec}` : int) };
  }
}
