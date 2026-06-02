export interface Invoice {
  id: string;
  uuid: string;
  series: string;
  number: string;
  date: string;
  total: number;
  status: "certified" | "voided" | "error";
  saleId?: string;
}
