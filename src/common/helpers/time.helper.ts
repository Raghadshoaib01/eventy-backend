// src/common/helpers/time.helper.ts

/**
 * تحويل وقت بصيغة "HH:mm" إلى عدد الدقائق منذ منتصف الليل
 */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * يتحقق أن [evStart, evEnd] يقع بالكامل داخل نافذة [winStart, winEnd]
 * مع دعم النوافذ التي تمتد بعد منتصف الليل (مثال: 22:00 → 02:00)
 */
export function isRangeWithinWindow(
  evStartRaw: string,
  evEndRaw: string,
  winStartRaw: string,
  winEndRaw: string,
): boolean {
  const winStart = timeToMinutes(winStartRaw);
  let winEnd = timeToMinutes(winEndRaw);
  const winWraps = winEnd <= winStart;
  if (winWraps) winEnd += 24 * 60;

  let evStart = timeToMinutes(evStartRaw);
  let evEnd = timeToMinutes(evEndRaw);
  if (evEnd <= evStart) evEnd += 24 * 60;

  // إذا كانت النافذة تمتد بعد منتصف الليل وبداية الحدث رقميًا أصغر من بداية
  // النافذة (مثال: حدث 00:30 ضمن نافذة 22:00-02:00)، نزيحه ليوم تالٍ للمقارنة
  if (winWraps && evStart < winStart) {
    evStart += 24 * 60;
    evEnd += 24 * 60;
  }

  return evStart >= winStart && evEnd <= winEnd;
}

/**
 * يتحقق من تقاطع فترتين زمنيتين (يُستخدم لفحص BlockedSlot).
 * لا يدعم امتداد الفترة (b) بعد منتصف الليل، لأن فترات الحجب الحالية
 * في النظام لا تمتد لليوم التالي.
 */
export function rangesOverlap(
  aStartRaw: string,
  aEndRaw: string,
  bStartRaw: string,
  bEndRaw: string,
): boolean {
  let aStart = timeToMinutes(aStartRaw);
  let aEnd = timeToMinutes(aEndRaw);
  if (aEnd <= aStart) aEnd += 24 * 60;

  const bStart = timeToMinutes(bStartRaw);
  const bEnd = timeToMinutes(bEndRaw);

  return aStart < bEnd && bStart < aEnd;
}