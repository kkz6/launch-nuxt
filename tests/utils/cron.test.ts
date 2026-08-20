import { describe, expect, it } from "vitest";
import { describeCronExpression } from "../../utils/cron";

describe("describeCronExpression", () => {
  it.each([
    [null, "No schedule configured"],
    ["", "No schedule configured"],
    ["@hourly", "Every hour"],
    ["daily_3am", "Every day at 3:00 AM"],
    ["* * * * *", "Every minute"],
    ["*/5 * * * *", "Every 5 minutes"],
    ["15 * * * *", "Every hour at 15 minutes past"],
    ["0 */6 * * *", "Every 6 hours"],
    ["15 */6 * * *", "Every 6 hours at 15 minutes past"],
    ["0 3 * * *", "Every day at 3:00 AM"],
    ["0 15 * * *", "Every day at 3:00 PM"],
    ["0 3 * * 1-5", "Monday through Friday at 3:00 AM"],
    ["0 3 * * 0,6", "Every Saturday and Sunday at 3:00 AM"],
    ["0 3 * * 1", "Every Monday at 3:00 AM"],
    ["0 3 * * 7", "Every Sunday at 3:00 AM"],
    ["0 3 * * 1,5", "Every Monday and Friday at 3:00 AM"],
    ["0 3 * * 1,3,5", "Every Monday, Wednesday, and Friday at 3:00 AM"],
    ["0 3 1 * *", "On the 1st of every month at 3:00 AM"],
    ["0 0 11 * *", "On the 11th of every month at 12:00 AM"],
    ["30 23 22 * *", "On the 22nd of every month at 11:30 PM"],
    ["0 0 23 2 *", "Every February 23rd at 12:00 AM"],
    ["0 0 24 2 *", "Every February 24th at 12:00 AM"],
    ["  0   3   *   *   *  ", "Every day at 3:00 AM"],
  ])("describes %s", (expression, expected) => {
    expect(describeCronExpression(expression)).toBe(expected);
  });

  it.each([
    "not a cron",
    "*/0 * * * *",
    "0 */24 * * *",
    "60 3 * * *",
    "0 24 * * *",
    "0 3 * * 9",
    "0 3 32 * *",
    "0 3 1 13 *",
    "0,30 3 * * *",
  ])("falls back for unsupported expression %s", (expression) => {
    expect(describeCronExpression(expression)).toBe(
      "Runs on a custom schedule",
    );
  });

  it.each([
    [null, "スケジュールが設定されていません"],
    ["@hourly", "毎時"],
    ["*/5 * * * *", "5分ごと"],
    ["0 3 * * *", "毎日 03:00"],
    ["0 3 * * 1-5", "月曜日から金曜日 03:00"],
    ["0 3 1 * *", "毎月1日 03:00"],
    ["0 0 23 2 *", "毎年2月23日 00:00"],
    ["not a cron", "カスタムスケジュールで実行されます"],
  ])("describes %s in Japanese", (expression, expected) => {
    expect(describeCronExpression(expression, "ja-JP")).toBe(expected);
  });
});
