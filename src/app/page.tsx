"use client";

import styles from "./page.module.css";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Movement, MovementType } from "@/types/movement";
import Link from "next/link";
import { getMovements, saveMovements } from "@/lib/movementStorage";

type ReceiptItem = {
  description: string;
  amount: number;
};

export default function Dashboard() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMovementId, setCurrentMovementId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: "income" as MovementType,
    category: "otros"
  });

  const totalIncome: number = movements
    .filter((m) => m.type === "income")
    .reduce((total, current) => total + current.amount, 0);

  const totalExpenses: number = movements
    .filter((m) => m.type === "expense")
    .reduce((total, current) => total + current.amount, 0);

  const balance: number = totalIncome - totalExpenses;

  async function processReceiptText(ocrText: string): Promise<ReceiptItem[]> {
    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: ocrText
      })
    });

    if (!response.ok) {
      throw new Error("Error processing receipt");
    }

    const result: unknown = await response.json();

    if (
      typeof result !== "object" ||
      result === null ||
      !("items" in result) ||
      !Array.isArray(result.items)
    ) {
      throw new Error("Invalid receipt response");
    }

    return result.items.filter(
      (item): item is ReceiptItem =>
        typeof item === "object" &&
        item !== null &&
        "description" in item &&
        typeof item.description === "string" &&
        item.description.trim() !== "" &&
        "amount" in item &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount > 0
    );
  }

  async function handleOCR() {
    if (!selectedFile || isProcessing) {
      return;
    }

    let worker = null;

    setIsProcessing(true);
    setReceiptItems([]);

    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("spa");

      const { data } = await worker.recognize(selectedFile);

      setOcrText(data.text);

      const result = await processReceiptText(data.text);

      setReceiptItems(result);

      console.log("Gemini results:", result);
    } catch (error) {
      console.error("Receipt processing error:", error);
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setIsProcessing(false);
    }
  }

  function handleConfirmReceipt() {
    if (receiptItems.length === 0) {
      return;
    }

    const newMovements: Movement[] = receiptItems.map((item) => ({
      id: crypto.randomUUID(),
      description: item.description,
      amount: item.amount,
      type: "expense",
      category: "alimentacion",
      date: new Date().toISOString()
    }));

    setMovements((previous) => [...previous, ...newMovements]);

    setReceiptItems([]);
    setOcrText("");
    setSelectedFile(null);
  }

  function handleEdit(movement: Movement) {
    setCurrentMovementId(movement.id);

    setFormData({
      description: movement.description,
      amount: String(movement.amount),
      type: movement.type,
      category: movement.category
    });
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      setMovements(getMovements());
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    saveMovements(movements);
  }, [movements, isLoaded]);

  function handleDelete(id: string) {
    setMovements(movements.filter((movement) => movement.id !== id));
  }

  function resetForm() {
    setCurrentMovementId(null);

    setFormData({
      description: "",
      amount: "",
      type: "income" as MovementType,
      category: "otros"
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (Number(formData.amount) <= 0) {
      return;
    }

    if (formData.description.trim() === "") {
      return;
    }

    if (currentMovementId) {
      setMovements(movements.map((m) =>
        m.id === currentMovementId
          ? {
              ...m,
              description: formData.description,
              amount: Number(formData.amount),
              category: formData.category,
              type: formData.type
            }
          : m
      ));

      resetForm();
      return;
    }

    const new_movement: Movement = {
      id: crypto.randomUUID(),
      description: formData.description,
      amount: Number(formData.amount),
      type: formData.type,
      category: formData.category,
      date: new Date().toISOString()
    };

    setMovements((previous) => [...previous, new_movement]);

    resetForm();
  }

  return (
    <main className={styles.container}>
      <aside className={styles.sidebar}>
        <nav className={styles.nav}>
          <h1>Mis Finanzas</h1>
          <h3>General</h3>
          <ul className={styles["nav-list"]}>
            <li>
              <Link className={styles["nav-link"]} href="/">
                Dashboard
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      <section className={styles["main-content"]}>
        <div className={styles["balance-card"]}>
          <h2 className={styles["balance-title"]}>Balance actual</h2>
          <p className={styles["balance-amount"]}>${balance.toFixed(2)}</p>
        </div>

        <div className={styles["summary-grid"]}>
          <div className={styles["income-card"]}>
            <h3>Ingresos</h3>
            <p>${totalIncome.toFixed(2)}</p>
          </div>

          <div className={styles["expense-card"]}>
            <h3>Gastos</h3>
            <p>${totalExpenses.toFixed(2)}</p>
          </div>
        </div>

        <label htmlFor="capture-input">Escanear ticket</label>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          id="capture-input"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />

        <button className={styles.button+" "+styles["button-primary"]} onClick={handleOCR} disabled={isProcessing}>
          {isProcessing ? "Procesando ticket..." : "Procesar ticket"}
        </button>

        {receiptItems.length > 0 && (
          <section>
            <h2>Artículos detectados</h2>

            {receiptItems.map((item, index) => (
              <div key={index}>
                <p>{item.description}</p>
                <p>${item.amount.toFixed(2)}</p>
              </div>
            ))}

            <p>
              Total: $
              {receiptItems
                .reduce((total, item) => total + item.amount, 0)
                .toFixed(2)}
            </p>

            <button className={styles.button+" "+styles["button-primary"]} onClick={handleConfirmReceipt}>
              Agregar artículos a movimientos
            </button>
          </section>
        )}

        <form onSubmit={handleSubmit} className={styles["movement-form"]}>
          <label htmlFor="description">Descripción</label>
          <input
            type="text"
            name="description"
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((previous) => ({
              ...previous,
              description: e.target.value
            }))}
          />

          <label htmlFor="importe">Importe</label>
          <input
            type="number"
            name="importe"
            id="importe"
            value={formData.amount}
            onChange={(e) => setFormData((previous) => ({
              ...previous,
              amount: e.target.value
            }))}
          />

          <label htmlFor="tipo">Tipo</label>
          <select
            name="tipo"
            id="tipo"
            value={formData.type}
            onChange={(e) => setFormData((previous) => ({
              ...previous,
              type: e.target.value as MovementType
            }))}
          >
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>

          <label htmlFor="categoria">Categoría</label>
          <select
            name="categoria"
            id="categoria"
            value={formData.category}
            onChange={(e) => setFormData((previous) => ({
              ...previous,
              category: e.target.value
            }))}
          >
            <option value="salario">Salario</option>
            <option value="alimentacion">Alimentación</option>
            <option value="transporte">Transporte</option>
            <option value="vivienda">Vivienda</option>
            <option value="otros">Otros</option>
          </select>

          <button className={styles.button+" "+styles["button-primary"]} type="submit">
            {!currentMovementId ? "Agregar movimiento" : "Guardar cambios"}
          </button>
        </form>

        <section>
          <h2>{movements.length > 0 ? "Últimos movimientos" : ""}</h2>

          <div>
            {movements.map((m) => (
              <div key={m.id} className={styles["movement-item"]}>
                {m.description}
                <br />
                <div className={styles["movement-actions"]}>
                  <button className={styles.button+" "+styles["button-secondary"]} onClick={() => handleEdit(m)}>Editar</button>
                  <button className={styles.button+" "+styles["button-danger"]} onClick={() => handleDelete(m.id)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}