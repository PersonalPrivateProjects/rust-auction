
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  getSubastas,
  createSubasta,
  crearPuja,
  iniciarSubasta,
  finalizarSubasta,
} from "../subastasProxy";
import { useGlobalContext } from "../GlobalContext";

interface Subasta {
  id: string;
  nombre: string;
  descripcion: string;
  importe_minimo: string;
  fecha_inicio: string; // segundos
  fecha_fin: string; // segundos
  estado: string; // creada | activa | finalizada
  publicKey: string;
  creador: string;
  ganador: string;
  importe_ganador: string;
}

export default function DashboardPage() {
  const { walletAddress } = useGlobalContext();

  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    importe_minimo: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  const [pujaForms, setPujaForms] = useState<{ [id: string]: boolean }>({});
  const [pujaValues, setPujaValues] = useState<{ [id: string]: string }>({});
  const [pujando, setPujando] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  async function fetchData() {
    setLoading(true);
    const wallet = typeof window !== "undefined" ? (window as any).solana : null;
    const data = await getSubastas(wallet);
    setSubastas(data);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const wallet = typeof window !== "undefined" ? (window as any).solana : null;

    // 🔥 tu program usa segundos (unix_timestamp)
    const formWithSeconds = {
      ...form,
      fecha_inicio: Math.floor(new Date(form.fecha_inicio).getTime() / 1000).toString(),
      fecha_fin: Math.floor(new Date(form.fecha_fin).getTime() / 1000).toString(),
    };

    try {
      await createSubasta(wallet, formWithSeconds);
    } catch (err: any) {
      alert("Error creando subasta: " + (err?.message || err));
      console.error(err);
    }

    setForm({
      nombre: "",
      descripcion: "",
      importe_minimo: "",
      fecha_inicio: "",
      fecha_fin: "",
    });
    setShowForm(false);
    setCreating(false);
    fetchData();
  }

  async function handlePujar(e: React.FormEvent, subastaId: string) {
    e.preventDefault();
    setPujando((p) => ({ ...p, [subastaId]: true }));

    const wallet = typeof window !== "undefined" ? (window as any).solana : null;

    try {
      await crearPuja(wallet, {
        id: subastaId,
        importe_puja: pujaValues[subastaId],
      });
    } catch (error: any) {
      if (error && error.message) {
          const match = error.message.match(/Error Message:\s*(.*)$/);
          if (match) {
           const resultado = match[1]; // "Error Message: Ya finalizo."     
             alert("Error al pujar: " + (resultado));
          }else{
             alert("Error al pujar: " + (error?.message));
          }
          console.error("Error al crear puja:", error);
      }
    }

    setPujaForms((f) => ({ ...f, [subastaId]: false }));
    setPujaValues((v) => ({ ...v, [subastaId]: "" }));
    setPujando((p) => ({ ...p, [subastaId]: false }));
    fetchData();
  }

  async function handleIniciar(id: string) {
    const wallet = typeof window !== "undefined" ? (window as any).solana : null;
    try {
      await iniciarSubasta(wallet, id);
      fetchData();
    } catch (err: any) {
      alert("Error al iniciar: " + (err?.message || err));
      console.error(err);
    }
  }

  async function handleFinalizar(id: string) {
    const wallet = typeof window !== "undefined" ? (window as any).solana : null;
    try {
      await finalizarSubasta(wallet, id);
      fetchData();
    } catch (err: any) {
      alert("Error al finalizar: " + (err?.message || err));
      console.error(err);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "2rem auto" }}>
      <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        Subastas
      </h2>

      <button
        onClick={() => setShowForm((v) => !v)}
        style={{
          marginBottom: 16,
          background: showForm ? "#e0e7ef" : "#2563eb",
          color: showForm ? "#2563eb" : "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 24px",
          fontWeight: 600,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        {showForm ? "Cancelar" : "Crear Subasta"}
      </button>

      {showForm && (
        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginBottom: 24,
            border: "1px solid #e5e7eb",
            padding: 24,
            borderRadius: 12,
            background: "#f8fafc",
           
          }}
        >
          <input
            required
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6,  color: "#111"}}
          />
          <input
            required
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, color: "#111" }}
          />
          <input
            required
            placeholder="Importe mínimo"
            type="number"
            value={form.importe_minimo}
            onChange={(e) => setForm((f) => ({ ...f, importe_minimo: e.target.value }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, color: "#111" }}
          />
          <input
            required
            placeholder="Fecha inicio"
            type="datetime-local"
            value={form.fecha_inicio}
            onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, color: "#111" }}
          />
          <input
            required
            placeholder="Fecha fin"
            type="datetime-local"
            value={form.fecha_fin}
            onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
            style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 6, color: "#111" }}
          />

          <button
            type="submit"
            disabled={creating}
            style={{
              background: creating ? "#93c5fd" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 600,
              fontSize: 16,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Creando..." : "Crear"}
          </button>
        </form>
      )}

      {loading ? (
        <div>Cargando...</div>
      ) : subastas.length === 0 ? (
        <div>No hay subastas.</div>
      ) : (
        <ul style={{ alignItems: "center", listStyle: "none", padding: 0 }}>
          {subastas.map((s, index) => {
            const isOwner = walletAddress && s.creador === walletAddress;
            return (
              <li
                key={index}
                style={{ border: "1px solid #eee", marginBottom: 12, padding: 12, borderRadius: 6, color: "#FDFBF7" }}
              >
                <div>
                  <b>{s.nombre}</b> (ID: {s.id})
                </div>
                <div>{s.descripcion}</div>
                <div>Creador: {s.creador}</div>
                <div>Importe mínimo: {s.importe_minimo}</div>
                <div>
                  Inicio: {new Date(Number(s.fecha_inicio) * 1000).toLocaleString()} | Fin:{" "}
                  {new Date(Number(s.fecha_fin) * 1000).toLocaleString()}
                </div>
                <div>Estado: {s.estado}</div>
                <div>Ganador actual: {s.ganador}</div>
                <div>Importe ganador: {s.importe_ganador}</div>

                <div style={{ fontSize: "0.85em", color: "#FFFDD0" }}>PDA: {s.publicKey}</div>

                {/* Iniciar/Finalizar sólo creador */}
                {isOwner && s.estado === "creada" && (
                  <button
                    style={{
                      marginTop: 8,
                      background: "#f59e0b",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 18px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => handleIniciar(s.id)}
                  >
                    Iniciar
                  </button>
                )}

                {isOwner && s.estado === "activa" && (
                  <button
                    style={{
                      marginTop: 8,
                      marginLeft: 12,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 18px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => handleFinalizar(s.id)}
                  >
                    Finalizar
                  </button>
                )}

                {/* Pujar */}
                {s.estado === "activa" && (
                  <button
                    style={{
                      marginTop: 8,
                      marginLeft: 12,
                      background: "#22c55e",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 18px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => setPujaForms((f) => ({ ...f, [s.id]: !pujaForms[s.id] }))}
                  >
                    {pujaForms[s.id] ? "Cancelar" : "Pujar"}
                  </button>
                )}

                <Link
                  href={`/dashboard/${s.id}`}
                  style={{
                    marginLeft: 12,
                    color: "#2563eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Ver detalle y pujas
                </Link>

                {pujaForms[s.id] && (
                  <form
                    onSubmit={(e) => handlePujar(e, s.id)}
                    style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <input
                      required
                      type="number"
                      min={Number(s.importe_ganador || s.importe_minimo) + 1}
                      placeholder="Importe puja"
                      value={pujaValues[s.id] || ""}
                      onChange={(e) =>
                        setPujaValues((v) => ({ ...v, [s.id]: e.target.value }))
                      }
                      style={{
                        padding: "6px 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 5,
                        fontSize: 15,
                        width: 170,
                      }}
                    />
                    <button
                      type="submit"
                      disabled={pujando[s.id]}
                      style={{
                        background: pujando[s.id] ? "#a7f3d0" : "#22c55e",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        padding: "6px 18px",
                        fontWeight: 600,
                        cursor: pujando[s.id] ? "not-allowed" : "pointer",
                      }}
                    >
                      {pujando[s.id] ? "Pujando..." : "Confirmar Puja"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
