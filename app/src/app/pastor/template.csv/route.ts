import { RESOURCE_CSV_COLUMNS } from "@/lib/catalog/parse";

export function GET() {
  const example = [
    "rn-example-1",
    "Example Series",
    "示例系列",
    "A short description of the series.",
    "系列簡介。",
    "https://www.rightnowmedia.org/Content/Series/000000",
    "en;zh-Hant",
    "6",
    "20",
    "video",
    "2",
    "true",
    "anxiety;prayer",
    "true",
  ];
  const csv = `${RESOURCE_CSV_COLUMNS.join(",")}\n${example.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")}\n`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="resource-template.csv"',
    },
  });
}
