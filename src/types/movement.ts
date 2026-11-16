export type MovementType = "income" | "expense";

export type Movement = {
    id: string;
    description: string;
    amount: number;
    type: MovementType;
    category: string;
    date: string;
}