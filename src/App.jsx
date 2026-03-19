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
const DEFAULT_BRANCH_FOLDER = "Tum Denemeler";

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

function bosBransDeneme(id, ders, folderName) {
  return {
    id,
    ad: `${folderName} Deneme ${id}`,
    date: new Date().toISOString().slice(0, 10),
    dogru: "",
    yanlis: "",
    bos: "",
    net: 0,
  };
}

function createEmptyBransFolders() {
  const empty = {};
  DERSLER.forEach((d) => {
    empty[d] = { [DEFAULT_BRANCH_FOLDER]: [] };
  });
  return empty;
}

function createDefaultActiveFolders() {
  const active = {};
  DERSLER.forEach((d) => {
    active[d] = DEFAULT_BRANCH_FOLDER;
  });
  return active;
}

function normalizeBransFolders(rawBransDenemeler) {
  const normalized = {};
  DERSLER.forEach((ders) => {
    const raw = rawBransDenemeler?.[ders];
    if (Array.isArray(raw)) {
      // Eski format migration: ders -> deneme[]
      normalized[ders] = { [DEFAULT_BRANCH_FOLDER]: raw };
      return;
    }
    if (raw && typeof raw === "object") {
      const folderEntries = Object.entries(raw).filter(([, v]) =>
        Array.isArray(v),
      );
      if (folderEntries.length > 0) {
        normalized[ders] = {};
        folderEntries.forEach(([folderName, list]) => {
          normalized[ders][folderName] = list;
        });
        return;
      }
    }
    normalized[ders] = { [DEFAULT_BRANCH_FOLDER]: [] };
  });
  return normalized;
}

function getVisibleBransDenemeler(folderMap, aktifFolder) {
  if (!folderMap) return [];
  if (aktifFolder !== DEFAULT_BRANCH_FOLDER) {
    return folderMap[aktifFolder] || [];
  }

  return Object.entries(folderMap).flatMap(([folderName, list]) =>
    (list || []).map((deneme) => ({
      ...deneme,
      __sourceFolder: folderName,
      __rowKey: `${folderName}-${deneme.id}`,
    })),
  );
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
        return createEmptyBransFolders();
      }
      const parsed = JSON.parse(raw);
      if (
        parsed?.bransDenemeler &&
        typeof parsed.bransDenemeler === "object"
      ) {
        return normalizeBransFolders(parsed.bransDenemeler);
      }
      return createEmptyBransFolders();
    } catch {
      return createEmptyBransFolders();
    }
  });
  const [aktifBransKlasorleri, setAktifBransKlasorleri] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return createDefaultActiveFolders();
      }
      const parsed = JSON.parse(raw);
      const defaults = createDefaultActiveFolders();
      if (
        parsed?.aktifBransKlasorleri &&
        typeof parsed.aktifBransKlasorleri === "object"
      ) {
        DERSLER.forEach((ders) => {
          const value = parsed.aktifBransKlasorleri[ders];
          if (typeof value === "string" && value.trim()) {
            defaults[ders] = value;
          }
        });
      }
      return defaults;
    } catch {
      return createDefaultActiveFolders();
    }
  });
  const [aktifSekme, setAktifSekme] = useState("Genel");
  const [importError, setImportError] = useState("");
  const [importOk, setImportOk] = useState(false);

  const handleExport = () => {
    const payload = { genelDenemeler, bransDenemeler, aktifBransKlasorleri };
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
        const safeBrans = normalizeBransFolders(parsed.bransDenemeler);
        const safeActive = createDefaultActiveFolders();
        DERSLER.forEach((ders) => {
          const folderNames = Object.keys(safeBrans[ders] || {});
          const requested = parsed?.aktifBransKlasorleri?.[ders];
          if (
            typeof requested === "string" &&
            folderNames.includes(requested)
          ) {
            safeActive[ders] = requested;
          } else if (folderNames.length > 0) {
            safeActive[ders] = folderNames[0];
          }
        });
        setGenelDenemeler(parsed.genelDenemeler);
        setBransDenemeler(safeBrans);
        setAktifBransKlasorleri(safeActive);
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
    const payload = { genelDenemeler, bransDenemeler, aktifBransKlasorleri };
    try {
      console.log("SAVE to LS:", payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("SAVE ERROR", err);
    }
  }, [genelDenemeler, bransDenemeler, aktifBransKlasorleri]);

  const handleAddDeneme = () => {
    if (aktifSekme === "Genel") {
      setGenelDenemeler((prev) => {
        const nextId = (prev.at(-1)?.id || 0) + 1;
        return [...prev, bosGenelDeneme(nextId)];
      });
      return;
    }

    setBransDenemeler((prev) => {
      const aktifKlasor =
        aktifBransKlasorleri[aktifSekme] || DEFAULT_BRANCH_FOLDER;
      const folderMap = prev[aktifSekme] || { [DEFAULT_BRANCH_FOLDER]: [] };
      const list = folderMap[aktifKlasor] || [];
      const nextId = (list.at(-1)?.id || 0) + 1;
      return {
        ...prev,
        [aktifSekme]: {
          ...folderMap,
          [aktifKlasor]: [...list, bosBransDeneme(nextId, aktifSekme, aktifKlasor)],
        },
      };
    });
  };

  const handleDeleteDeneme = (id, sourceFolder) => {
    if (aktifSekme === "Genel") {
      setGenelDenemeler((prev) => prev.filter((d) => d.id !== id));
    } else {
      const aktifKlasor =
        aktifBransKlasorleri[aktifSekme] || DEFAULT_BRANCH_FOLDER;
      const targetFolder = sourceFolder || aktifKlasor;
      setBransDenemeler((prev) => ({
        ...prev,
        [aktifSekme]: {
          ...(prev[aktifSekme] || { [DEFAULT_BRANCH_FOLDER]: [] }),
          [targetFolder]: (prev[aktifSekme]?.[targetFolder] || []).filter(
            (d) => d.id !== id,
          ),
        },
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

  const handleChangeBransSonuc = (denemeId, ders, alan, value, sourceFolder) => {
    setBransDenemeler((prev) => {
      const aktifKlasor = aktifBransKlasorleri[ders] || DEFAULT_BRANCH_FOLDER;
      const targetFolder = sourceFolder || aktifKlasor;
      const folderMap = prev[ders] || { [DEFAULT_BRANCH_FOLDER]: [] };
      const list = folderMap[targetFolder] || [];
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
        [ders]: {
          ...folderMap,
          [targetFolder]: updated,
        },
      };
    });
  };

  const handleAddFolder = (ders, folderNameInput) => {
    const folderName = folderNameInput?.trim();
    if (!folderName) return;

    setBransDenemeler((prev) => {
      const current = prev[ders] || { [DEFAULT_BRANCH_FOLDER]: [] };
      if (current[folderName]) {
        return prev;
      }
      return {
        ...prev,
        [ders]: {
          ...current,
          [folderName]: [],
        },
      };
    });

    setAktifBransKlasorleri((prev) => ({
      ...prev,
      [ders]: folderName,
    }));
  };

  const handleSelectFolder = (ders, folderName) => {
    setAktifBransKlasorleri((prev) => ({
      ...prev,
      [ders]: folderName,
    }));
  };

  const handleRenameFolder = (ders, folderName, nextNameInput) => {
    if (folderName === DEFAULT_BRANCH_FOLDER) return;
    const nextName = nextNameInput?.trim();
    if (!nextName || nextName === folderName) return;

    setBransDenemeler((prev) => {
      const current = prev[ders] || { [DEFAULT_BRANCH_FOLDER]: [] };
      if (!current[folderName] || current[nextName]) return prev;

      const renamed = {};
      Object.keys(current).forEach((key) => {
        if (key === folderName) {
          renamed[nextName] = current[key];
        } else {
          renamed[key] = current[key];
        }
      });

      return {
        ...prev,
        [ders]: renamed,
      };
    });

    setAktifBransKlasorleri((prev) => ({
      ...prev,
      [ders]: prev[ders] === folderName ? nextName : prev[ders],
    }));
  };

  const handleDeleteFolder = (ders, folderName) => {
    if (folderName === DEFAULT_BRANCH_FOLDER) return;
    setBransDenemeler((prev) => {
      const current = prev[ders] || { [DEFAULT_BRANCH_FOLDER]: [] };
      const names = Object.keys(current);
      if (!current[folderName] || names.length <= 1) {
        return prev;
      }
      if (!window.confirm(`"${folderName}" klasorunu silmek istiyor musun?`)) {
        return prev;
      }

      const nextFolders = { ...current };
      delete nextFolders[folderName];

      setAktifBransKlasorleri((activePrev) => {
        if (activePrev[ders] !== folderName) return activePrev;
        return {
          ...activePrev,
          [ders]: Object.keys(nextFolders)[0] || DEFAULT_BRANCH_FOLDER,
        };
      });

      return {
        ...prev,
        [ders]: nextFolders,
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
      const aktifKlasor = aktifBransKlasorleri[ders] || DEFAULT_BRANCH_FOLDER;
      const list = getVisibleBransDenemeler(bransDenemeler[ders], aktifKlasor);
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
  }, [bransDenemeler, aktifBransKlasorleri]);

  const aktifBransDenemeler =
    aktifSekme === "Genel"
      ? []
      : getVisibleBransDenemeler(
          bransDenemeler[aktifSekme],
          aktifBransKlasorleri[aktifSekme] || DEFAULT_BRANCH_FOLDER,
        );

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
                <strong>{aktifBransDenemeler.length}</strong>
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
          denemeler={aktifBransDenemeler}
          folderMap={bransDenemeler[aktifSekme] || {}}
          folderNames={Object.keys(bransDenemeler[aktifSekme] || {})}
          aktifFolder={aktifBransKlasorleri[aktifSekme] || DEFAULT_BRANCH_FOLDER}
          onSelectFolder={handleSelectFolder}
          onAddFolder={handleAddFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
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

function DersTab({
  ders,
  denemeler,
  folderMap,
  folderNames,
  aktifFolder,
  onSelectFolder,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  ortalamalar,
  onChangeSonuc,
  onDeleteDeneme,
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const startRename = (folderName) => {
    setRenameTarget(folderName);
    setRenameValue(folderName);
  };

  const submitRename = () => {
    if (!renameTarget) return;
    onRenameFolder(ders, renameTarget, renameValue);
    setRenameTarget("");
    setRenameValue("");
  };

  const submitAddFolder = () => {
    onAddFolder(ders, newFolderName);
    setNewFolderName("");
  };

  const chartData = denemeler.map((d, idx) => ({
    x: idx + 1,
    y: Number(d.net || 0),
  }));

  const folderStats = folderNames.map((folderName) => {
    const list =
      folderName === DEFAULT_BRANCH_FOLDER
        ? getVisibleBransDenemeler(folderMap, DEFAULT_BRANCH_FOLDER)
        : folderMap?.[folderName] || [];
    const denemeSayisi = list.length;
    const ortNet = denemeSayisi
      ? Number(
          (
            list.reduce((sum, item) => sum + (Number(item.net) || 0), 0) /
            denemeSayisi
          ).toFixed(2),
        )
      : 0;
    const sonTarih = denemeSayisi
      ? list.reduce((maxDate, item) => {
          const date = item.date || "";
          return date > maxDate ? date : maxDate;
        }, "")
      : "-";

    return {
      folderName,
      denemeSayisi,
      ortNet,
      sonTarih: sonTarih || "-",
    };
  });

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

      <section className="folder-card">
        <div className="folder-card-header">
          <h3>Yayinevi Klasorleri</h3>
          <span>{folderNames.length} klasor</span>
        </div>

        <div className="folder-dashboard">
          {folderStats.map((stat) => (
            <button
              key={`dash-${stat.folderName}`}
              className={`folder-dash-card ${aktifFolder === stat.folderName ? "active" : ""}`}
              onClick={() => onSelectFolder(ders, stat.folderName)}
            >
              <div className="folder-dash-title">{stat.folderName}</div>
              <div className="folder-dash-meta">
                <span>{stat.denemeSayisi} deneme</span>
                <span>Ort: {stat.ortNet}</span>
              </div>
              <div className="folder-dash-date">Son: {stat.sonTarih}</div>
            </button>
          ))}
        </div>

        <div className="folder-row">
          {folderNames.map((folderName) => (
            <div key={folderName} className="folder-item">
              {renameTarget === folderName ? (
                <>
                  <input
                    className="folder-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename();
                      if (e.key === "Escape") {
                        setRenameTarget("");
                        setRenameValue("");
                      }
                    }}
                    autoFocus
                  />
                  <button className="folder-mini-btn save" onClick={submitRename}>
                    Kaydet
                  </button>
                  <button
                    className="folder-mini-btn"
                    onClick={() => {
                      setRenameTarget("");
                      setRenameValue("");
                    }}
                  >
                    Vazgec
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`folder-btn ${aktifFolder === folderName ? "active" : ""}`}
                    onClick={() => onSelectFolder(ders, folderName)}
                  >
                    {folderName}
                  </button>
                {folderName !== DEFAULT_BRANCH_FOLDER && (
                  <>
                    <button
                      className="folder-mini-btn"
                      title="Yeniden adlandir"
                      onClick={() => startRename(folderName)}
                    >
                      Duzenle
                    </button>
                    <button
                      className="folder-mini-btn danger"
                      title="Klasoru sil"
                      onClick={() => onDeleteFolder(ders, folderName)}
                    >
                      Sil
                    </button>
                  </>
                )}
                </>
              )}
            </div>
          ))}
          <div className="folder-create">
            <input
              className="folder-input"
              placeholder="Yeni klasor adi"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitAddFolder();
              }}
            />
            <button className="folder-mini-btn save" onClick={submitAddFolder}>
              Ekle
            </button>
          </div>
        </div>
      </section>

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
              <tr key={d.__rowKey || d.id}>
                <td className="sticky-col">
                  {d.__sourceFolder
                    ? `${d.__sourceFolder} Deneme ${d.id}`
                    : `${aktifFolder} Deneme ${d.id}`}
                </td>
                <td>{d.date}</td>
                <td>
                  <input
                    type="text"
                    value={d.dogru ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(
                        d.id,
                        ders,
                        "dogru",
                        e.target.value,
                        d.__sourceFolder,
                      )
                    }
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={d.yanlis ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(
                        d.id,
                        ders,
                        "yanlis",
                        e.target.value,
                        d.__sourceFolder,
                      )
                    }
                    inputMode="numeric"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={d.bos ?? ""}
                    onChange={(e) =>
                      onChangeSonuc(
                        d.id,
                        ders,
                        "bos",
                        e.target.value,
                        d.__sourceFolder,
                      )
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
                    onClick={() => onDeleteDeneme(d.id, d.__sourceFolder)}
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


