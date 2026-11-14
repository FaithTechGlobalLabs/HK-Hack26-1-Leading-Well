"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { importCsvAction, type ImportState } from "@/app/pastor/actions";
import { SubmitButton } from "@/components/submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export function ImportForm() {
  const t = useTranslations("pastor");
  const [state, action] = useActionState<ImportState, FormData>(importCsvAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="csv-file">{t("csvFile")}</Label>
          <Input id="csv-file" name="file" type="file" accept=".csv,text/csv" className="h-auto py-1.5" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="csv-source">{t("source")}</Label>
          <Select id="csv-source" name="source" defaultValue="rightnow" className="w-auto">
            <option value="rightnow">RightNow Media</option>
            <option value="custom">{t("sourceCustom")}</option>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="csv-text">{t("csvPaste")}</Label>
        <Textarea id="csv-text" name="csv" rows={4} className="font-mono text-xs" placeholder="external_id,title,title_zh,description,..." />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={t("importing")}>{t("import")}</SubmitButton>
        <a className="text-sm underline" href="/pastor/template.csv" download>
          {t("downloadTemplate")}
        </a>
      </div>
      {state.imported !== undefined && (
        <p role="status" className="text-sm text-success" data-testid="import-result">
          {t("imported", { n: state.imported })}
        </p>
      )}
      {!!state.errors?.length && (
        <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
          {state.errors.slice(0, 10).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
