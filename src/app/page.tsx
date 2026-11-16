"use client";

import styles from "./page.module.css";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Movement, MovementType } from "@/types/movement";
import Link from "next/link";
import { getMovements, saveMovements} from "@/lib/movementStorage"

export default function Dashboard() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMovementId, setCurrentMovementId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    type: ( "income" as MovementType ),
    category: "otros"
  });

  const totalIncome: number = movements
    .filter((m) => m.type === "income")
    .reduce((total, current) => total + current.amount, 0);

  const totalExpenses: number = movements
    .filter((m) => m.type === "expense")
    .reduce((total, current) => total + current.amount, 0);

  const balance: number = totalIncome - totalExpenses;

  function handleEdit(movement: Movement) {
    setCurrentMovementId(movement.id);
    setFormData(
      {
        description: movement.description,
        amount: String(movement.amount),
        type: movement.type,
        category: movement.category
      }

    );


  }



  useEffect(() => {
    Promise.resolve().then(
      () => {
        setMovements(getMovements());
        setIsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if ( !isLoaded ) {
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
      type: ('income' as MovementType),
      category: 'otros'
    })
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (Number(formData.amount) <= 0) {
      return;
    }

    if (formData.description.trim() === "") {
      return;
    }

    if(currentMovementId) {
      setMovements(movements.map((m) => m.id === currentMovementId ? {...m,
        description: formData.description,
        amount: Number(formData.amount),
        category: formData.category,
        type: formData.type } : m));

      resetForm();

      return;
    }

    const new_movement: Movement = {
      id: crypto.randomUUID(),
      description: formData.description,
      amount: Number(formData.amount),
      type: formData.type,
      category: formData.category,
      date: new Date().toISOString(),
    };

    setMovements((p) => [...p, new_movement]);

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
            <li>
              <Link className={styles["nav-link"]} href="/movimientos">
                Movimientos
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
      <section className={styles["main-content"]}>
        <div className={styles["balance-card"]}>
          <h2 className={styles["balance-title"]}>Balance actual</h2>
          <p className={styles["balance-amount"]}>${balance}</p>
        </div>
        <div className={styles["summary-grid"]}>
          <div className={styles["income-card"]}>
            <h3>Ingresos</h3>
            <p>${totalIncome}</p>
          </div>
          <div className={styles["expense-card"]}>
            <h3>Gastos</h3>
            <p>${totalExpenses}</p>
          </div>
        </div>
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
              type: (e.target.value as MovementType)
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

          <button type="submit">{!currentMovementId ? 'Agregar movimiento' : 'Guardar cambios' }</button>
        </form>

        <section>
          <h2>{movements.length > 0 ? "Últimos movimientos" : ""}</h2>
          <div>
            {movements.map((m) => (
              <p key={m.id} className={styles["movement-item"]}>
                {m.description} <br />
                <button onClick={() => handleEdit(m)}>Editar</button>
                <button onClick={() => handleDelete(m.id)}>Eliminar</button>
              </p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
