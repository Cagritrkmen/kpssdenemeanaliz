import { Fragment, useEffect, useMemo, useState } from "react";
import "./index.css";

const DERSLER = [
  "Türkçe",
  "Matematik",
  "Tarih",
  "Coğrafya",
  "Vatandaşlık",
  "Güncel Bilgiler",
];
const STORAGE_KEY = "kpssDenemeAnaliz";

const yanlisGötürüDefault = 4;

function hesaplaNet(dogru, yanlis, _bos) {
  const d = Number(dogru) || 0;
  const y = Number(yanlis) || 0;
  const net = d - y / yanlisGötürüDefault;
  return Number.isFinite(net) ? Number(net.toFixed(2)) : 0;
}

function bosGenelDeneme(id) {
  const results = {};
  DERSLER.forEach((d) => {
    results[d] = { dogru: "", yanlis: "", bos: "", net: 0 };
  });
  return {
    id,
    ad: `Genel Deneme ${id}`,
    date: new Date().toISOString().slice(0, 10),
    results,
  };
}

function bosBransDeneme(id, ders) {
  return {
    id,
    ad: `${ders} Deneme ${id}`,
    date: new Date().toISOString().slice(0, 10),
    dogru: "",
    yanlis: "",
    bos: "",
    net: 0,
  };
}

function App() {
  const [genelDenemeler, setGenelDenemeler] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      console.log("INIT LOAD raw from LS:", raw);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      console.log("INIT LOAD parsed:", parsed);
      if (Array.isArray(parsed?.genelDenemeler)) {
        return parsed.genelDenemeler;
      }
      return [];
    } catch (err) {
      console.error("INIT LOAD ERROR", err);
      return [];
    }
  });
  const [bransDenemeler, setBransDenemeler] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const empty = {};
        DERSLER.forEach((d) => {
          empty[d] = [];
        });
        return empty;
      }
      const parsed = JSON.parse(raw);
      if (parsed?.bransDenemeler && typeof parsed.bransDenemeler === "object") {
        const base = {};
        DERSLER.forEach((d) => {
          base[d] = Array.isArray(parsed.bransDenemeler[d])
            ? parsed.bransDenemeler[d]
            : [];
        });
        return base;
      }
      const empty = {};
      DERSLER.forEach((d) => {
        empty[d] = [];
      });
      return empty;
    } catch {
      const empty = {};
      DERSLER.forEach((d) => {
        empty[d] = [];
      });
      return empty;
    }
  });
  const [aktifSekme, setAktifSekme] = useState("Genel");
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState(false);

  const handleExport = () => {
    const payload = { genelDenemeler, bransDenemeler };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `kpss-deneme-veri-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file) => {
    if (!file) return;
    setImportError("");
    setImportOk(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result || "");
        const parsed = JSON.parse(text);
        if (
          !parsed ||
          !Array.isArray(parsed.genelDenemeler) ||
          typeof parsed.bransDenemeler !== "object"
        ) {
          throw new Error("Geçersiz JSON yapısı");
        }
        const safeBrans = {};
        DERSLER.forEach((d) => {
          safeBrans[d] = Array.isArray(parsed.bransDenemeler?.[d])
            ? parsed.bransDenemeler[d]
            : [];
        });
        setGenelDenemeler(parsed.genelDenemeler);
        setBransDenemeler(safeBrans);
        setImportOk(true);
      } catch (err) {
        console.error("IMPORT ERROR", err);
        setImportError("JSON dosyası beklenen formatta değil.");
      }
    };
    reader.readAsText(file);
  };

  // localStorage'a yaz
  useEffect(() => {
    const payload = { genelDenemeler, bransDenemeler };
    try {
      console.log("SAVE to LS:", payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("SAVE ERROR", err);
    }
  }, [genelDenemeler, bransDenemeler]);

  const handleAddDeneme = () => {
    if (aktifSekme === "Genel") {
      setGenelDenemeler((prev) => {
        const nextId = (prev.at(-1)?.id || 0) + 1;
        return [...prev, bosGenelDeneme(nextId)];
      });
      return;
    }

    setBransDenemeler((prev) => {
      const list = prev[aktifSekme] || [];
      const nextId = (list.at(-1)?.id || 0) + 1;
      return {
        ...prev,
        [aktifSekme]: [...list, bosBransDeneme(nextId, aktifSekme)],
      };
    });
  };

  const handleDeleteDeneme = (id) => {
    if (aktifSekme === "Genel") {
      setGenelDenemeler((prev) => prev.filter((d) => d.id !== id));
    } else {
      setBransDenemeler((prev) => ({
        ...prev,
        [aktifSekme]: (prev[aktifSekme] || []).filter((d) => d.id !== id),
      }));
    }
  };

  const handleChangeGenelSonuc = (denemeId, ders, alan, value) => {
    setGenelDenemeler((prev) =>
      prev.map((d) => {
        if (d.id !== denemeId) return d;
        const current = d.results[ders] || {
          dogru: "",
          yanlis: "",
          bos: "",
          net: 0,
        };

        const nextField = {
          ...current,
          [alan]: value.replace(/[^\d]/g, ""),
        };

        const net = hesaplaNet(
          nextField.dogru,
          nextField.yanlis,
          nextField.bos,
        );

        return {
          ...d,
          results: {
            ...d.results,
            [ders]: { ...nextField, net },
          },
        };
      }),
    );
  };

  const handleChangeBransSonuc = (denemeId, ders, alan, value) => {
    setBransDenemeler((prev) => {
      const list = prev[ders] || [];
      const updated = list.map((d) => {
        if (d.id !== denemeId) return d;
        const nextField = {
          ...d,
          [alan]: value.replace(/[^\d]/g, ""),
        };
        const net = hesaplaNet(
          nextField.dogru,
          nextField.yanlis,
          nextField.bos,
        );
        return { ...nextField, net };
      });
      return {
        ...prev,
        [ders]: updated,
      };
    });
  };

  const genelOrtalamalar = useMemo(() => {
    const byDers = {};
    DERSLER.forEach((ders) => {
      if (!genelDenemeler.length) {
        byDers[ders] = 0;
        return;
      }
      const toplam = genelDenemeler.reduce((sum, d) => {
        const r = d.results?.[ders];
        return sum + (Number(r?.net) || 0);
      }, 0);
      byDers[ders] = Number((toplam / genelDenemeler.length).toFixed(2));
    });
    return byDers;
  }, [genelDenemeler]);

  const genelToplamNet = useMemo(() => {
    if (!genelDenemeler.length) return 0;
    const sum = genelDenemeler.reduce((sum, d) => {
      const dersToplam = DERSLER.reduce((acc, ders) => {
        const r = d.results?.[ders];
        return acc + (Number(r?.net) || 0);
      }, 0);
      return sum + dersToplam;
    }, 0);
    return Number((sum / genelDenemeler.length).toFixed(2));
  }, [genelDenemeler]);

  const bransOrtalamalar = useMemo(() => {
    const byDers = {};
    DERSLER.forEach((ders) => {
      const list = bransDenemeler[ders] || [];
      if (!list.length) {
        byDers[ders] = 0;
        return;
      }
      const toplam = list.reduce(
        (sum, d) => sum + (Number(d.net) || 0),
        0,
      );
      byDers[ders] = Number((toplam / list.length).toFixed(2));
    });
    return byDers;
  }, [bransDenemeler]);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>KPSS Deneme Analiz Paneli</h1>
        <p>
          Genel Yetenek · Genel Kültür (Türkçe, Matematik, Tarih, Coğrafya,
          Vatandaşlık, Güncel Bilgiler) net ve ortalamalar
        </p>
      </header>

      <section className="controls-row">
        <div className="controls-left">
          <button className="primary-btn" onClick={handleAddDeneme}>
            {aktifSekme === "Genel"
              ? "+ Genel Deneme Ekle"
              : `+ ${aktifSekme} Denemesi Ekle`}
          </button>
          <span className="deneme-count">
            {aktifSekme === "Genel" ? (
              <>
                Genel deneme sayısı: <strong>{genelDenemeler.length}</strong>
              </>
            ) : (
              <>
                {aktifSekme} deneme sayısı:{" "}
                <strong>{bransDenemeler[aktifSekme]?.length ?? 0}</strong>
              </>
            )}
          </span>
        </div>
        <div className="controls-right">
          <button className="ghost-btn" onClick={handleExport}>
            Veriyi JSON Olarak İndir
          </button>
          <label className="ghost-btn">
            JSON Yükle
            <input
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImportFile(file);
                  e.target.value = "";
                }
              }}
            />
          </label>
        </div>
      </section>

      {importError && (
        <p className="import-message import-error">{importError}</p>
      )}
      {importOk && !importError && (
        <p className="import-message import-ok">
          JSON başarıyla yüklendi.
        </p>
      )}

      <nav className="tabs">
        {["Genel", ...DERSLER].map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${aktifSekme === tab ? "active" : ""}`}
            onClick={() => setAktifSekme(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {aktifSekme === "Genel" ? (
        <GenelTab
          denemeler={genelDenemeler}
          ortalamalar={genelOrtalamalar}
          toplamNet={genelToplamNet}
          onChangeSonuc={handleChangeGenelSonuc}
          onDeleteDeneme={handleDeleteDeneme}
        />
      ) : (
        <DersTab
          ders={aktifSekme}
          denemeler={bransDenemeler[aktifSekme] || []}
          ortalamalar={bransOrtalamalar}
          onChangeSonuc={handleChangeBransSonuc}
          onDeleteDeneme={handleDeleteDeneme}
        />
      )}
    </div>
  );
}

function GenelTab({
  denemeler,
  ortalamalar,
  toplamNet,
  onChangeSonuc,
  onDeleteDeneme,
}) {
  const chartData = denemeler.map((d, idx) => {
    const sumNet = DERSLER.reduce((acc, ders) => {
      const r = d.results?.[ders];
      return acc + (Number(r?.net) || 0);
    }, 0);
    return { x: idx + 1, y: sumNet };
  });

  const maxY =
    chartData.length > 0
      ? Math.max(...chartData.map((p) => p.y), 0)
      : 0;

  const chartWidth = 600;
  const chartHeight = 180;
  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 24;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const polylinePoints =
    chartData.length > 1 && maxY > 0
      ? chartData
          .map((p, idx) => {
            const x =
              paddingLeft +
              (chartData.length === 1
                ? innerWidth / 2
                : (innerWidth * idx) / (chartData.length - 1));
            const y =
              paddingTop + innerHeight - (p.y / maxY) * innerHeight;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  return (
    <section className="card card-genel">
      <div className="card-header">
        <div>
          <h2>Genel Tablo</h2>
          <p>Tüm dersler yan yana, her deneme bir satır.</p>
        </div>
        <div className="summary-badge">
          Ortalama toplam net: <strong>{toplamNet}</strong>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-wrapper">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="net-chart"
          >
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(129, 140, 248, 0.35)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0.0)" />
              </linearGradient>
            </defs>

            {/* axes */}
            <line
              x1={paddingLeft}
              y1={paddingTop + innerHeight}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + innerHeight}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth="1"
            />

            {/* main line */}
            {polylinePoints && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="2.5"
              />
            )}

            {/* points */}
            {chartData.map((p, idx) => {
              const x =
                paddingLeft +
                (chartData.length === 1
                  ? innerWidth / 2
                  : (innerWidth * idx) / (chartData.length - 1));
              const y =
                paddingTop + innerHeight - (p.y / maxY) * innerHeight;
              return (
                <g key={p.x}>
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill="#e5e7eb"
                    stroke="#111827"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#e5e7eb"
                  >
                    {p.y.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* x labels: deneme no */}
            {chartData.map((p, idx) => {
              const x =
                paddingLeft +
                (chartData.length === 1
                  ? innerWidth / 2
                  : (innerWidth * idx) / (chartData.length - 1));
              const y = paddingTop + innerHeight + 12;
              return (
                <text
                  key={`label-${p.x}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#9ca3af"
                >
                  {p.x}
                </text>
              );
            })}

            {/* y max label */}
            <text
              x={paddingLeft}
              y={paddingTop - 4}
              textAnchor="start"
              fontSize="10"
              fill="#9ca3af"
            >
              Max: {maxY.toFixed(1)}
            </text>

            <text
              x={chartWidth - paddingRight}
              y={chartHeight - 8}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              Deneme No / Toplam Net
            </text>
          </svg>
        </div>
      )}

      <div className="table-wrapper">
        <table className="deneme-table">
          <thead>
            <tr>
              <th rowSpan={2}>Deneme</th>
              <th rowSpan={2}>Tarih</th>
              {DERSLER.map((ders) => (
                <th key={ders} colSpan={4}>
                  {ders}
                </th>
              ))}
              <th rowSpan={2}></th>
            </tr>
            <tr>
              {DERSLER.map((ders) => (
                <Fragment key={ders}>
                  <th>D</th>
                  <th>Y</th>
                  <th>B</th>
                  <th>Net</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {denemeler.length === 0 && (
              <tr>
                <td colSpan={2 + DERSLER.length * 4 + 1} className="empty-row">
                  Henüz deneme eklemedin. Yukarıdan &quot;Deneme Ekle&quot; ile
                  başlayabilirsin.
                </td>
              </tr>
            )}
            {denemeler.map((d) => (
              <tr key={d.id}>
                <td className="sticky-col">{d.ad}</td>
                <td>
                  <input
                    type="date"
                    value={d.date || ""}
                    onChange={(e) =>
                      onChangeDenemeMeta(d.id, { date: e.target.value })
                    }
                  />
                </td>
                {DERSLER.map((ders) => {
                  const r = d.results?.[ders] || {};
                  return (
                    <Fragment key={ders}>
                      <td>
                        <input
                          type="text"
                          value={r.dogru ?? ""}
                          onChange={(e) =>
                            onChangeSonuc(d.id, ders, "dogru", e.target.value)
                          }
                          inputMode="numeric"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={r.yanlis ?? ""}
                          onChange={(e) =>
                            onChangeSonuc(d.id, ders, "yanlis", e.target.value)
                          }
                          inputMode="numeric"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={r.bos ?? ""}
                          onChange={(e) =>
                            onChangeSonuc(d.id, ders, "bos", e.target.value)
                          }
                          inputMode="numeric"
                        />
                      </td>
                      <td className="net-cell">
                        {Number(r.net || 0).toFixed(2)}
                      </td>
                    </Fragment>
                  );
                })}
                <td>
                  <button
                    className="ghost-btn danger"
                    onClick={() => onDeleteDeneme(d.id)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Ortalama</td>
              <td></td>
              {DERSLER.map((ders) => (
                <td key={ders} colSpan={4} className="avg-cell">
                  {ortalamalar[ders] ?? 0}
                </td>
              ))}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function onChangeDenemeMeta() {
  // Şimdilik meta güncellemeyi boş bırakıyoruz,
  // istersen sonra tarih / ad düzenleme logic ekleriz.
}

function DersTab({ ders, denemeler, ortalamalar, onChangeSonuc, onDeleteDeneme }) {
  const chartData = denemeler.map((d, idx) => ({
    x: idx + 1,
    y: Number(d.net || 0),
  }));

  const maxY =
    chartData.length > 0 ? Math.max(...chartData.map((p) => p.y), 0) : 0;

  const chartWidth = 600;
  const chartHeight = 180;
  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 24;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const polylinePoints =
    chartData.length > 1 && maxY > 0
      ? chartData
          .map((p, idx) => {
            const x =
              paddingLeft +
              (chartData.length === 1
                ? innerWidth / 2
                : (innerWidth * idx) / (chartData.length - 1));
            const y =
              paddingTop + innerHeight - (p.y / maxY) * innerHeight;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>{ders} Analizi</h2>
          <p>Bu derse özel doğru / yanlış / net takibi.</p>
        </div>
        <div className="summary-badge">
          Ortalama net: <strong>{ortalamalar[ders] ?? 0}</strong>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-wrapper">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="net-chart"
          >
            {/* axes */}
            <line
              x1={paddingLeft}
              y1={paddingTop + innerHeight}
              x2={paddingLeft + innerWidth}
              y2={paddingTop + innerHeight}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth="1"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={paddingTop + innerHeight}
              stroke="rgba(148,163,184,0.6)"
              strokeWidth="1"
            />

            {/* main line */}
            {polylinePoints && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="2.5"
              />
            )}

            {/* points */}
            {chartData.map((p, idx) => {
              const x =
                paddingLeft +
                (chartData.length === 1
                  ? innerWidth / 2
                  : (innerWidth * idx) / (chartData.length - 1));
              const y =
                paddingTop + innerHeight - (p.y / maxY) * innerHeight;
              return (
                <g key={p.x}>
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill="#e5e7eb"
                    stroke="#111827"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#e5e7eb"
                  >
                    {p.y.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* x labels: deneme no */}
            {chartData.map((p, idx) => {
              const x =
                paddingLeft +
                (chartData.length === 1
                  ? innerWidth / 2
                  : (innerWidth * idx) / (chartData.length - 1));
              const y = paddingTop + innerHeight + 12;
              return (
                <text
                  key={`label-${p.x}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#9ca3af"
                >
                  {p.x}
                </text>
              );
            })}

            {/* y max label */}
            <text
              x={paddingLeft}
              y={paddingTop - 4}
              textAnchor="start"
              fontSize="10"
              fill="#9ca3af"
            >
              Max: {maxY.toFixed(1)}
            </text>

            <text
              x={chartWidth - paddingRight}
              y={chartHeight - 8}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              Deneme No / Net
            </text>
          </svg>
        </div>
      )}

      <div className="table-wrapper">
        <table className="deneme-table narrow">
          <thead>
            <tr>
              <th>Deneme</th>
              <th>Tarih</th>
              <th>Doğru</th>
              <th>Yanlış</th>
              <th>Boş</th>
              <th>Net</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(!denemeler || denemeler.length === 0) && (
              <tr>
                <td colSpan={7} className="empty-row">
                  Henüz deneme eklemedin. Yukarıdan &quot;Deneme Ekle&quot; ile
                  başlayabilirsin.
                </td>
              </tr>
            )}
            {denemeler.map((d) => (
              <tr key={d.id}>
                <td className="sticky-col">{d.ad}</td>
                <td>{d.date}</td>
                <td>
                  <input
                    type="text"
                    value={d.dogru ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(d.id, ders, "dogru", e.target.value)
                    }
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={d.yanlis ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(d.id, ders, "yanlis", e.target.value)
                    }
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={d.bos ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(d.id, ders, "bos", e.target.value)
                    }
                    inputMode="numeric"
                  />
                </td>
                <td className="net-cell">
                  {Number(d.net || 0).toFixed(2)}
                </td>
                <td>
                  <button
                    className="ghost-btn danger"
                    onClick={() => onDeleteDeneme(d.id)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default App;


