import { parseISO } from "date-fns";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const parseDateValue = (value: string): Date => {
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return parseISO(value);
};

export const getLocalDateISO = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
