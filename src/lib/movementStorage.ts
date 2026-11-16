import type { Movement } from "@/types/movement";

const STORAGE_KEY: string = 'movements';

export function saveMovements(movements: Movement[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(movements));
}

export function getMovements(): Movement[] {
    const savedMovements = localStorage.getItem(STORAGE_KEY);

    if (savedMovements === null) {
        return [];
    }

    return JSON.parse(savedMovements);
}