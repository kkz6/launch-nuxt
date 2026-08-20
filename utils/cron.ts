const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const namedSchedules: Record<string, string> = {
  "@yearly": "Once a year on January 1st at 12:00 AM",
  "@annually": "Once a year on January 1st at 12:00 AM",
  "@monthly": "On the 1st of every month at 12:00 AM",
  "@weekly": "Every Sunday at 12:00 AM",
  "@daily": "Every day at 12:00 AM",
  "@midnight": "Every day at 12:00 AM",
  "@hourly": "Every hour",
  "@reboot": "At server startup",
  every_minute: "Every minute",
  every_5_minutes: "Every 5 minutes",
  every_15_minutes: "Every 15 minutes",
  every_30_minutes: "Every 30 minutes",
  hourly: "Every hour",
  daily: "Every day at 12:00 AM",
  daily_2am: "Every day at 2:00 AM",
  daily_3am: "Every day at 3:00 AM",
  weekly: "Every Sunday at 12:00 AM",
  monthly: "On the 1st of every month at 12:00 AM",
};

const japaneseWeekdayNames = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

const japaneseNamedSchedules: Record<string, string> = {
  "@yearly": "毎年1月1日 00:00",
  "@annually": "毎年1月1日 00:00",
  "@monthly": "毎月1日 00:00",
  "@weekly": "毎週日曜日 00:00",
  "@daily": "毎日 00:00",
  "@midnight": "毎日 00:00",
  "@hourly": "毎時",
  "@reboot": "サーバー起動時",
  every_minute: "毎分",
  every_5_minutes: "5分ごと",
  every_15_minutes: "15分ごと",
  every_30_minutes: "30分ごと",
  hourly: "毎時",
  daily: "毎日 00:00",
  daily_2am: "毎日 02:00",
  daily_3am: "毎日 03:00",
  weekly: "毎週日曜日 00:00",
  monthly: "毎月1日 00:00",
};

const parseNumber = (value: string, min: number, max: number) => {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
};

const ordinal = (value: number) => {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const formatTime = (hour: number, minute: number) => {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
};

const parseWeekday = (value: string) => {
  const parsed = parseNumber(value, 0, 7);
  return parsed === 7 ? 0 : parsed;
};

const joinNames = (values: string[]) => {
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
};

const describeWeekdays = (field: string): string | null => {
  if (field === "*") return "Every day";
  if (field === "1-5") return "Monday through Friday";
  if (field === "0,6" || field === "6,0" || field === "6,7") {
    return "Every Saturday and Sunday";
  }

  const weekdays = field.split(",").map(parseWeekday);
  if (weekdays.some((value) => value === null)) return null;
  return `Every ${joinNames(weekdays.map((value) => weekdayNames[value!]))}`;
};

const describeJapaneseWeekdays = (field: string): string | null => {
  if (field === "*") return "毎日";
  if (field === "1-5") return "月曜日から金曜日";
  if (field === "0,6" || field === "6,0" || field === "6,7") {
    return "毎週土曜日と日曜日";
  }

  const weekdays = field.split(",").map(parseWeekday);
  if (weekdays.some((value) => value === null)) return null;
  return `毎週${weekdays
    .map((value) => japaneseWeekdayNames[value!])
    .join("、")}`;
};

const describeJapaneseCronExpression = (normalized: string): string => {
  if (!normalized) return "スケジュールが設定されていません";

  const named = japaneseNamedSchedules[normalized.toLowerCase()];
  if (named) return named;

  const fields = normalized.split(" ");
  if (fields.length !== 5) return "カスタムスケジュールで実行されます";

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields;
  if (normalized === "* * * * *") return "毎分";

  const minuteStep = minuteField.match(/^\*\/(\d+)$/);
  if (
    minuteStep &&
    hourField === "*" &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    const interval = parseNumber(minuteStep[1], 1, 59);
    return interval
      ? `${interval}分ごと`
      : "カスタムスケジュールで実行されます";
  }

  const minute = parseNumber(minuteField, 0, 59);
  if (
    minute !== null &&
    hourField === "*" &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    return minute === 0 ? "毎時" : `毎時${minute}分`;
  }

  const hourStep = hourField.match(/^\*\/(\d+)$/);
  if (
    minute !== null &&
    hourStep &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    const interval = parseNumber(hourStep[1], 1, 23);
    if (!interval) return "カスタムスケジュールで実行されます";
    return minute === 0
      ? `${interval}時間ごと`
      : `${interval}時間ごとの${minute}分`;
  }

  const hour = parseNumber(hourField, 0, 23);
  if (minute === null || hour === null) {
    return "カスタムスケジュールで実行されます";
  }
  const time = `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;

  if (dayField === "*" && monthField === "*") {
    const weekdays = describeJapaneseWeekdays(weekdayField);
    return weekdays
      ? `${weekdays} ${time}`
      : "カスタムスケジュールで実行されます";
  }

  const day = parseNumber(dayField, 1, 31);
  if (day !== null && weekdayField === "*") {
    if (monthField === "*") return `毎月${day}日 ${time}`;

    const month = parseNumber(monthField, 1, 12);
    if (month !== null) return `毎年${month}月${day}日 ${time}`;
  }

  return "カスタムスケジュールで実行されます";
};

export const describeCronExpression = (
  expression: string | null | undefined,
  requestedLocale = "en",
): string => {
  const normalized = expression?.trim().replace(/\s+/g, " ") ?? "";
  if (requestedLocale.toLowerCase().startsWith("ja")) {
    return describeJapaneseCronExpression(normalized);
  }
  if (!normalized) return "No schedule configured";

  const named = namedSchedules[normalized.toLowerCase()];
  if (named) return named;

  const fields = normalized.split(" ");
  if (fields.length !== 5) return "Runs on a custom schedule";

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields;

  if (normalized === "* * * * *") return "Every minute";

  const minuteStep = minuteField.match(/^\*\/(\d+)$/);
  if (
    minuteStep &&
    hourField === "*" &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    const interval = parseNumber(minuteStep[1], 1, 59);
    return interval ? `Every ${interval} minutes` : "Runs on a custom schedule";
  }

  const minute = parseNumber(minuteField, 0, 59);
  if (
    minute !== null &&
    hourField === "*" &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    return minute === 0 ? "Every hour" : `Every hour at ${minute} minutes past`;
  }

  const hourStep = hourField.match(/^\*\/(\d+)$/);
  if (
    minute !== null &&
    hourStep &&
    dayField === "*" &&
    monthField === "*" &&
    weekdayField === "*"
  ) {
    const interval = parseNumber(hourStep[1], 1, 23);
    if (!interval) return "Runs on a custom schedule";
    return minute === 0
      ? `Every ${interval} hours`
      : `Every ${interval} hours at ${minute} minutes past`;
  }

  const hour = parseNumber(hourField, 0, 23);
  if (minute === null || hour === null) return "Runs on a custom schedule";
  const time = formatTime(hour, minute);

  if (dayField === "*" && monthField === "*") {
    const weekdays = describeWeekdays(weekdayField);
    return weekdays ? `${weekdays} at ${time}` : "Runs on a custom schedule";
  }

  const day = parseNumber(dayField, 1, 31);
  if (day !== null && weekdayField === "*") {
    if (monthField === "*") {
      return `On the ${ordinal(day)} of every month at ${time}`;
    }

    const month = parseNumber(monthField, 1, 12);
    if (month !== null) {
      return `Every ${monthNames[month - 1]} ${ordinal(day)} at ${time}`;
    }
  }

  return "Runs on a custom schedule";
};
