import { expect, type Page } from '@playwright/test';

export async function fillDateField(page: Page, labelText: string, value: string, fallbackIndex = 0) {
  const labelKey = labelText.toLowerCase();
  const idFallback =
    labelKey.includes('registered date')
      ? page.locator('#registered_date')
      : labelKey.includes('date of birth')
        ? page.locator('#dob')
        : null;
  const label = page.locator('label', { hasText: labelText }).first();
  let inputById: ReturnType<Page['locator']> | null = null;
  if ((await label.count()) > 0) {
    const forId = await label.getAttribute('for');
    if (forId) {
      inputById = page.locator(`#${forId}`);
    }
  }

  const byRole = page.getByRole('textbox', { name: new RegExp(labelText, 'i') });
  const inputByLabel = page.locator(
    `xpath=//*[contains(normalize-space(), "${labelText}")]/following::input[1]`
  );

  const fallbacks = [
    idFallback,
    inputById,
    byRole,
    inputByLabel.first(),
    page.getByPlaceholder('YYYY/MM/DD').nth(fallbackIndex),
    page.getByPlaceholder('YYYY-MM-DD').nth(fallbackIndex),
    page.locator('form').locator('input').first()
  ].filter(Boolean) as Array<ReturnType<Page['locator']>>;

  let target = fallbacks[0];
  for (const candidate of fallbacks) {
    if ((await candidate.count()) > 0) {
      target = candidate;
      break;
    }
  }

  await expect(target, `Date input not found for label: ${labelText}`).toBeVisible();
  await target.click({ clickCount: 3 });
  await target.press('Backspace');
  await target.type(value, { delay: 10 });
  await target.press('Tab');
  await target.evaluate((el, nextValue) => {
    const input = el as HTMLInputElement;
    const value = String(nextValue);
    const descriptor = Object.getOwnPropertyDescriptor(input, 'value');
    const prototype = Object.getPrototypeOf(input);
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (prototypeDescriptor?.set && descriptor?.set !== prototypeDescriptor.set) {
      prototypeDescriptor.set.call(input, value);
    } else if (descriptor?.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
