/* ====================== CONFIG FIREBASE ====================== */
const DB_URL = "https://pratabiosevervenci-default-rtdb.europe-west1.firebasedatabase.app";

async function dbGet(path, query = "") {
  const res = await fetch(`${DB_URL}/${path}.json${query}`);
  if (!res.ok) throw new Error("Erro ao ler dados");
  const data = await res.json();
  return data || {};
}
async function dbPost(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: "POST", body: JSON.stringify(data) });
  return res.json();
}
async function dbPut(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: "PUT", body: JSON.stringify(data) });
  return res.json();
}
async function dbPatch(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: "PATCH", body: JSON.stringify(data) });
  return res.json();
}
async function dbDelete(path) {
  const res = await fetch(`${DB_URL}/${path}.json`, { method: "DELETE" });
  return res.json();
}
function qEqual(field, value) {
  return `?orderBy=${encodeURIComponent('"' + field + '"')}&equalTo=${encodeURIComponent('"' + value + '"')}`;
}

/* ====================== HELPERS DE DATA ====================== */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso, dias) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + Number(dias));
  return d.toISOString().slice(0, 10);
}
function addMonthsISO(iso, months) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}
function diasRestantes(vencISO) {
  const hoje = new Date(todayISO() + "T00:00:00");
  const venc = new Date(vencISO + "T00:00:00");
  return Math.round((venc - hoje) / 86400000);
}
function formatBR(iso) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function situacao(vencISO) {
  const dias = diasRestantes(vencISO);
  if (dias < 0) return { label: "Vencido", cls: "vencido" };
  if (dias <= 30) return { label: `${dias} dia(s)`, cls: "atencao" };
  return { label: `${dias} dias`, cls: "ok" };
}
function esc(str) {
  return (str || "").toString().replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}
function normaliza(str) {
  // remove acentos e caixa para facilitar a busca ("joão" == "joao")
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/* ====================== COMBOBOX (busca com autocomplete) ======================
   Componente genérico usado nos campos de "Funcionário" e "EPI" das telas de
   Entregar/Renovar e Exportar. Em vez de um <select> comum, o usuário digita
   e vê sugestões filtradas em tempo real, podendo navegar com o teclado.
*/
function criarCombobox({ inputId, hiddenId, listId, clearId, getData, renderMain, renderSub, matchFields, onSelect, onClear }) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  const list = document.getElementById(listId);
  const clearBtn = clearId ? document.getElementById(clearId) : null;
  let activeIndex = -1;
  let currentItems = [];

  function itemLabel(obj) {
    return renderMain(obj) || "";
  }

  function atualizarBotaoLimpar() {
    if (!clearBtn) return;
    clearBtn.classList.toggle("hidden", !hidden.value);
  }

  function fechar() {
    list.classList.add("hidden");
    list.innerHTML = "";
    activeIndex = -1;
  }

  function marcarValidade() {
    input.classList.toggle("is-valid", !!hidden.value);
  }

  function abrir(termo) {
    const data = getData() || {};
    const termoNorm = normaliza(termo);
    const entries = Object.entries(data).filter(([id, obj]) => {
      if (!termoNorm) return true;
      const campos = matchFields(obj).map(normaliza);
      return campos.some((c) => c.includes(termoNorm));
    });

    // ordena alfabeticamente pelo texto principal
    entries.sort((a, b) => itemLabel(a[1]).localeCompare(itemLabel(b[1]), "pt-BR"));

    currentItems = entries;
    activeIndex = -1;

    if (entries.length === 0) {
      list.innerHTML = `<div class="combobox-empty">Nenhum resultado encontrado</div>`;
      list.classList.remove("hidden");
      return;
    }

    list.innerHTML = entries
      .map(([id, obj], i) => {
        const sub = renderSub ? renderSub(obj) : "";
        return `<div class="combobox-item" data-id="${esc(id)}" data-index="${i}">
          <span class="combo-main">${esc(itemLabel(obj))}</span>
          ${sub ? `<span class="combo-sub">${esc(sub)}</span>` : ""}
        </div>`;
      })
      .join("");
    list.classList.remove("hidden");
  }

  function selecionar(id) {
    const data = getData() || {};
    const obj = data[id];
    if (!obj) return;
    hidden.value = id;
    input.value = itemLabel(obj);
    marcarValidade();
    atualizarBotaoLimpar();
    fechar();
    if (onSelect) onSelect(id, obj);
  }

  function limpar() {
    hidden.value = "";
    input.value = "";
    marcarValidade();
    atualizarBotaoLimpar();
    fechar();
    if (onClear) onClear();
    input.focus();
  }

  input.addEventListener("focus", () => abrir(input.value));
  input.addEventListener("input", () => {
    if (hidden.value) {
      hidden.value = "";
      marcarValidade();
      atualizarBotaoLimpar();
    }
    abrir(input.value);
  });

  input.addEventListener("keydown", (e) => {
    const itens = list.querySelectorAll(".combobox-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (list.classList.contains("hidden")) return abrir(input.value);
      activeIndex = Math.min(activeIndex + 1, itens.length - 1);
      itens.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      itens[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      itens.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
      itens[activeIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      if (!list.classList.contains("hidden") && activeIndex >= 0 && currentItems[activeIndex]) {
        e.preventDefault();
        selecionar(currentItems[activeIndex][0]);
      }
    } else if (e.key === "Escape") {
      fechar();
    }
  });

  list.addEventListener("mousedown", (e) => {
    const item = e.target.closest(".combobox-item");
    if (!item) return;
    e.preventDefault();
    selecionar(item.dataset.id);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      limpar();
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`#${inputId}`) && !e.target.closest(`#${listId}`)) {
      fechar();
    }
  });

  input.addEventListener("blur", () => {
    // se o texto digitado não corresponde a uma seleção válida, avisa visualmente
    setTimeout(() => {
      if (!hidden.value && input.value.trim() !== "") {
        input.classList.add("is-valid"); // evita ficar vermelho sem necessidade
        input.classList.remove("is-valid");
      }
    }, 150);
  });

  atualizarBotaoLimpar();
  marcarValidade();

  return { limpar, selecionar, refresh: () => abrir(input.value) };
}

/* ====================== ROTEAMENTO ====================== */
const routes = ["dashboard", "funcionarios", "epis", "entregas", "analise"];
const loaded = {}; // cache simples por seção

function router() {
  let hash = location.hash.replace("#", "") || "dashboard";
  if (!routes.includes(hash)) hash = "dashboard";

  routes.forEach((r) => {
    document.getElementById("sec-" + r).classList.toggle("hidden", r !== hash);
    const link = document.querySelector(`.nav-link[data-route="${r}"]`);
    if (link) link.classList.toggle("active", r === hash);
  });

  // reinicia a animação de entrada da página ativa (força reflow)
  const secAtiva = document.getElementById("sec-" + hash);
  secAtiva.classList.remove("page-anim");
  void secAtiva.offsetWidth;
  secAtiva.classList.add("page-anim");

  if (hash === "dashboard") loadDashboard();
  if (hash === "funcionarios") loadFuncionarios();
  if (hash === "epis") loadEpis();
  if (hash === "entregas") loadEntregasPage();
  if (hash === "analise") loadAnalise();
}
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("entData").value = todayISO();
  router();
});

/* ====================== DASHBOARD ====================== */
async function loadDashboard() {
  const body = document.getElementById("dashAlertBody");
  body.innerHTML = `<tr><td colspan="5" class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</td></tr>`;

  const limite = addDaysISO(todayISO(), 30);

  const [entregasRange, funcionarios, epis] = await Promise.all([
    dbGet("entregas", `?orderBy=${encodeURIComponent('"dataVencimento"')}&endAt=${encodeURIComponent('"' + limite + '"')}`),
    dbGet("funcionarios"),
    dbGet("epis"),
  ]);

  document.getElementById("dashFuncionarios").textContent = Object.keys(funcionarios).length;
  document.getElementById("dashEpis").textContent = Object.keys(epis).length;

  const lista = Object.entries(entregasRange).filter(([id, e]) => e.status === "ativo");
  const vencidos = lista.filter(([id, e]) => diasRestantes(e.dataVencimento) < 0);
  const atencao = lista.filter(([id, e]) => diasRestantes(e.dataVencimento) >= 0);

  document.getElementById("dashVencidos").textContent = vencidos.length;
  document.getElementById("dashAtencao").textContent = atencao.length;

  const todos = [...vencidos, ...atencao].sort((a, b) => diasRestantes(a[1].dataVencimento) - diasRestantes(b[1].dataVencimento));

  if (todos.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="muted"><svg class="icon muted-icon"><use href="#i-check"/></svg>Nenhum alerta de vencimento</td></tr>`;
    return;
  }

  body.innerHTML = todos
    .map(([id, e], i) => {
      const sit = situacao(e.dataVencimento);
      return `<tr style="animation-delay:${Math.min(i, 12) * 30}ms">
        <td>${esc(e.funcionarioNome)}</td>
        <td>${esc(e.epiNome)}</td>
        <td>${esc(e.epiRegistro)}</td>
        <td>${formatBR(e.dataVencimento)}</td>
        <td><span class="badge ${sit.cls}">${sit.label}</span></td>
      </tr>`;
    })
    .join("");
}

/* ====================== FUNCIONÁRIOS ====================== */
let funcionariosCache = {};

async function loadFuncionarios() {
  const body = document.getElementById("funcionariosBody");
  body.innerHTML = `<tr><td colspan="4" class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</td></tr>`;
  funcionariosCache = await dbGet("funcionarios");
  renderFuncionarios(funcionariosCache);
}

function renderFuncionarios(data) {
  const body = document.getElementById("funcionariosBody");
  const entries = Object.entries(data);
  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="muted">Nenhum funcionário cadastrado</td></tr>`;
    return;
  }
  body.innerHTML = entries
    .map(
      ([id, f], i) => `<tr style="animation-delay:${Math.min(i, 12) * 30}ms">
      <td>${esc(f.nome)}</td>
      <td>${esc(f.cargo) || "-"}</td>
      <td>${esc(f.matricula) || "-"}</td>
      <td>
        <button class="btn small ver" onclick="abrirFichaFuncionario('${id}')"><svg class="icon"><use href="#i-file"/></svg>Ficha</button>
        <button class="btn small edit" onclick="editarFuncionario('${id}')"><svg class="icon"><use href="#i-pencil"/></svg>Editar</button>
        <button class="btn small delete" onclick="excluirFuncionario('${id}')"><svg class="icon"><use href="#i-trash"/></svg>Excluir</button>
      </td>
    </tr>`
    )
    .join("");
}

document.getElementById("formFuncionario").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("funcId").value;
  const dados = {
    nome: document.getElementById("funcNome").value.trim(),
    cargo: document.getElementById("funcCargo").value.trim(),
    matricula: document.getElementById("funcMatricula").value.trim(),
    dataCadastro: id ? funcionariosCache[id]?.dataCadastro || todayISO() : todayISO(),
  };
  if (id) {
    await dbPut(`funcionarios/${id}`, dados);
  } else {
    await dbPost("funcionarios", dados);
  }
  document.getElementById("formFuncionario").reset();
  document.getElementById("funcId").value = "";
  document.getElementById("funcCancelar").classList.add("hidden");
  loadFuncionarios();
});

function editarFuncionario(id) {
  const f = funcionariosCache[id];
  document.getElementById("funcId").value = id;
  document.getElementById("funcNome").value = f.nome || "";
  document.getElementById("funcCargo").value = f.cargo || "";
  document.getElementById("funcMatricula").value = f.matricula || "";
  document.getElementById("funcCancelar").classList.remove("hidden");
  window.scrollTo(0, 0);
}
document.getElementById("funcCancelar").addEventListener("click", () => {
  document.getElementById("formFuncionario").reset();
  document.getElementById("funcId").value = "";
  document.getElementById("funcCancelar").classList.add("hidden");
});

async function excluirFuncionario(id) {
  if (!confirm("Excluir este funcionário? Isso não apaga o histórico de entregas.")) return;
  await dbDelete(`funcionarios/${id}`);
  loadFuncionarios();
}

document.getElementById("buscaFuncionario").addEventListener("input", (e) => {
  const termo = normaliza(e.target.value);
  const filtrado = Object.fromEntries(
    Object.entries(funcionariosCache).filter(([id, f]) =>
      [f.nome, f.cargo, f.matricula].some((campo) => normaliza(campo).includes(termo))
    )
  );
  renderFuncionarios(filtrado);
});

/* ====================== FICHA INDIVIDUAL (MODAL) ====================== */
async function abrirFichaFuncionario(id) {
  const modal = document.getElementById("modalFuncionario");
  const conteudo = document.getElementById("modalConteudo");
  conteudo.innerHTML = `<p class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</p>`;
  modal.classList.add("hidden");
  void modal.offsetWidth;
  modal.classList.remove("hidden");

  const [funcionario, entregas] = await Promise.all([
    dbGet(`funcionarios/${id}`),
    dbGet("entregas", qEqual("funcionarioId", id)),
  ]);

  const lista = Object.values(entregas).sort((a, b) => (a.dataVencimento < b.dataVencimento ? -1 : 1));

  conteudo.innerHTML = `
    <h2>${esc(funcionario.nome)}</h2>
    <p class="muted" style="text-align:left;padding:4px 0 14px;">
      ${esc(funcionario.cargo) || "-"} · Matrícula: ${esc(funcionario.matricula) || "-"}
    </p>
    <table class="tbl">
      <thead><tr><th>EPI</th><th>Registro</th><th>Entrega</th><th>Vencimento</th><th>Situação</th></tr></thead>
      <tbody>
        ${
          lista.length
            ? lista
                .map((e) => {
                  const sit = situacao(e.dataVencimento);
                  return `<tr>
                <td>${esc(e.epiNome)}</td>
                <td>${esc(e.epiRegistro)}</td>
                <td>${formatBR(e.dataEntrega)}</td>
                <td>${formatBR(e.dataVencimento)}</td>
                <td><span class="badge ${sit.cls}">${sit.label}</span></td>
              </tr>`;
                })
                .join("")
            : `<tr><td colspan="5" class="muted">Nenhum EPI entregue</td></tr>`
        }
      </tbody>
    </table>
    <div style="margin-top:16px;text-align:right;">
      <button class="btn primary" onclick="exportarFicha('${id}')"><svg class="icon"><use href="#i-printer"/></svg>Imprimir ficha</button>
    </div>
  `;
}
document.getElementById("modalFechar").addEventListener("click", () => {
  document.getElementById("modalFuncionario").classList.add("hidden");
});

/* ====================== EPIs ====================== */
let episCache = {};

async function loadEpis() {
  const body = document.getElementById("episBody");
  body.innerHTML = `<tr><td colspan="4" class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</td></tr>`;
  episCache = await dbGet("epis");
  renderEpis(episCache);
}

function renderEpis(data) {
  const body = document.getElementById("episBody");
  const entries = Object.entries(data);
  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="muted">Nenhum EPI cadastrado</td></tr>`;
    return;
  }
  body.innerHTML = entries
    .map(
      ([id, ep], i) => `<tr style="animation-delay:${Math.min(i, 12) * 30}ms">
      <td>${esc(ep.nome)}</td>
      <td>${esc(ep.registro)}</td>
      <td>${esc(ep.validadeMeses)} meses</td>
      <td>
        <button class="btn small edit" onclick="editarEpi('${id}')"><svg class="icon"><use href="#i-pencil"/></svg>Editar</button>
        <button class="btn small delete" onclick="excluirEpi('${id}')"><svg class="icon"><use href="#i-trash"/></svg>Excluir</button>
      </td>
    </tr>`
    )
    .join("");
}

document.getElementById("formEpi").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("epiId").value;
  const dados = {
    nome: document.getElementById("epiNome").value.trim(),
    registro: document.getElementById("epiRegistro").value.trim(),
    validadeMeses: Number(document.getElementById("epiValidadeDias").value),
    dataCadastro: id ? episCache[id]?.dataCadastro || todayISO() : todayISO(),
  };
  if (id) {
    await dbPut(`epis/${id}`, dados);
  } else {
    await dbPost("epis", dados);
  }
  document.getElementById("formEpi").reset();
  document.getElementById("epiId").value = "";
  document.getElementById("epiCancelar").classList.add("hidden");
  loadEpis();
});

function editarEpi(id) {
  const ep = episCache[id];
  document.getElementById("epiId").value = id;
  document.getElementById("epiNome").value = ep.nome || "";
  document.getElementById("epiRegistro").value = ep.registro || "";
  document.getElementById("epiValidadeDias").value = ep.validadeMeses || "";
  document.getElementById("epiCancelar").classList.remove("hidden");
  window.scrollTo(0, 0);
}
document.getElementById("epiCancelar").addEventListener("click", () => {
  document.getElementById("formEpi").reset();
  document.getElementById("epiId").value = "";
  document.getElementById("epiCancelar").classList.add("hidden");
});

async function excluirEpi(id) {
  if (!confirm("Excluir este tipo de EPI?")) return;
  await dbDelete(`epis/${id}`);
  loadEpis();
}

document.getElementById("buscaEpi").addEventListener("input", (e) => {
  const termo = normaliza(e.target.value);
  const filtrado = Object.fromEntries(
    Object.entries(episCache).filter(
      ([id, ep]) => normaliza(ep.nome).includes(termo) || normaliza(ep.registro).includes(termo)
    )
  );
  renderEpis(filtrado);
});

/* ====================== ENTREGAS / RENOVAÇÃO ====================== */
let entregasCache = {};
let comboFuncionarioEntrega, comboEpiEntrega;

async function loadEntregasPage() {
  const body = document.getElementById("entregasBody");
  body.innerHTML = `<tr><td colspan="8" class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</td></tr>`;

  const [funcionarios, epis, entregas] = await Promise.all([dbGet("funcionarios"), dbGet("epis"), dbGet("entregas")]);

  funcionariosCache = funcionarios;
  episCache = epis;
  entregasCache = entregas;

  // limpa seleção anterior ao recarregar a página
  document.getElementById("entFuncionarioInput").value = "";
  document.getElementById("entFuncionario").value = "";
  document.getElementById("entEpiInput").value = "";
  document.getElementById("entEpi").value = "";

  if (!comboFuncionarioEntrega) {
    comboFuncionarioEntrega = criarCombobox({
      inputId: "entFuncionarioInput",
      hiddenId: "entFuncionario",
      listId: "entFuncionarioList",
      clearId: "entFuncionarioClear",
      getData: () => funcionariosCache,
      renderMain: (f) => f.nome,
      renderSub: (f) => f.cargo || "",
      matchFields: (f) => [f.nome, f.cargo, f.matricula],
    });
  }

  if (!comboEpiEntrega) {
    comboEpiEntrega = criarCombobox({
      inputId: "entEpiInput",
      hiddenId: "entEpi",
      listId: "entEpiList",
      clearId: "entEpiClear",
      getData: () => episCache,
      renderMain: (ep) => ep.nome,
      renderSub: (ep) => `CA ${ep.registro} · validade ${ep.validadeMeses} meses`,
      matchFields: (ep) => [ep.nome, ep.registro],
    });
  }

  renderEntregas(entregasCache);
}

function renderEntregas(data) {
  const body = document.getElementById("entregasBody");
  const entries = Object.entries(data).sort((a, b) => (a[1].dataVencimento < b[1].dataVencimento ? -1 : 1));
  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="8" class="muted">Nenhuma entrega registrada</td></tr>`;
    return;
  }
  body.innerHTML = entries
    .map(([id, e], i) => {
      const sit = situacao(e.dataVencimento);
      return `<tr style="animation-delay:${Math.min(i, 12) * 30}ms">
        <td>${esc(e.funcionarioNome)}</td>
        <td>${esc(e.epiNome)}</td>
        <td>${esc(e.epiRegistro)}</td>
        <td>${formatBR(e.dataEntrega)}</td>
        <td>${formatBR(e.dataVencimento)}</td>
        <td>${diasRestantes(e.dataVencimento)}</td>
        <td><span class="badge ${sit.cls}">${sit.label}</span></td>
        <td><button class="btn small renovar" onclick="renovarEntrega('${id}')"><svg class="icon"><use href="#i-refresh"/></svg>Renovar</button></td>
      </tr>`;
    })
    .join("");
}

document.getElementById("formEntrega").addEventListener("submit", async (e) => {
  e.preventDefault();
  const funcId = document.getElementById("entFuncionario").value;
  const epiId = document.getElementById("entEpi").value;
  const dataEntrega = document.getElementById("entData").value;

  const funcionario = funcionariosCache[funcId];
  const epi = episCache[epiId];

  if (!funcionario) {
    alert("Selecione um funcionário válido na busca (clique em um resultado da lista).");
    document.getElementById("entFuncionarioInput").focus();
    return;
  }
  if (!epi) {
    alert("Selecione um EPI válido na busca (clique em um resultado da lista).");
    document.getElementById("entEpiInput").focus();
    return;
  }

  const dataVencimento = addMonthsISO(dataEntrega, epi.validadeMeses);

  const dados = {
    funcionarioId: funcId,
    funcionarioNome: funcionario.nome,
    epiId: epiId,
    epiNome: epi.nome,
    epiRegistro: epi.registro,
    dataEntrega,
    dataVencimento,
    status: "ativo",
    historico: [],
  };

  await dbPost("entregas", dados);
  document.getElementById("formEntrega").reset();
  document.getElementById("entData").value = todayISO();
  comboFuncionarioEntrega.limpar();
  comboEpiEntrega.limpar();
  loadEntregasPage();
});

async function renovarEntrega(id) {
  const e = entregasCache[id];
  if (!e) return;
  if (!confirm(`Renovar entrega de "${e.epiNome}" para ${e.funcionarioNome}?`)) return;

  const epi = episCache[e.epiId] || (await dbGet(`epis/${e.epiId}`));
  const novaEntrega = todayISO();
  const novoVencimento = addMonthsISO(novaEntrega, epi.validadeMeses);

  const historico = e.historico || [];
  historico.push({ dataEntrega: e.dataEntrega, dataVencimento: e.dataVencimento });

  await dbPatch(`entregas/${id}`, {
    dataEntrega: novaEntrega,
    dataVencimento: novoVencimento,
    status: "ativo",
    historico,
  });

  loadEntregasPage();
}

document.getElementById("buscaEntrega").addEventListener("input", (e) => {
  const termo = normaliza(e.target.value);
  const filtrado = Object.fromEntries(
    Object.entries(entregasCache).filter(([id, en]) =>
      [en.funcionarioNome, en.epiNome, en.epiRegistro].some((campo) => normaliza(campo).includes(termo))
    )
  );
  renderEntregas(filtrado);
});

/* ====================== ANÁLISE / EXPORTAR ====================== */
let analiseCache = {};
let comboFuncionarioExport;

/* Alterna entre "todos" e "um funcionário" no momento de gerar a impressão */
function atualizarModoExport() {
  const um = document.getElementById("modoUm").checked;
  const comboWrap = document.getElementById("comboExport");
  const exportInput = document.getElementById("exportFuncionarioInput");
  comboWrap.classList.toggle("is-disabled", !um);
  exportInput.disabled = !um;
  if (!um) {
    if (comboFuncionarioExport) comboFuncionarioExport.limpar();
    document.getElementById("exportFuncionario").value = "todos";
  }
}
document.getElementById("modoTodos").addEventListener("change", atualizarModoExport);
document.getElementById("modoUm").addEventListener("change", atualizarModoExport);

async function loadAnalise() {
  const body = document.getElementById("analiseBody");
  body.innerHTML = `<tr><td colspan="7" class="muted"><svg class="icon muted-icon spinner"><use href="#i-loader"/></svg>Carregando...</td></tr>`;

  const [entregas, funcionarios] = await Promise.all([dbGet("entregas"), dbGet("funcionarios")]);
  analiseCache = entregas;
  funcionariosCache = funcionarios;

  document.getElementById("exportFuncionarioInput").value = "";
  document.getElementById("exportFuncionario").value = "todos";
  document.getElementById("modoTodos").checked = true;
  atualizarModoExport();

  if (!comboFuncionarioExport) {
    comboFuncionarioExport = criarCombobox({
      inputId: "exportFuncionarioInput",
      hiddenId: "exportFuncionario",
      listId: "exportFuncionarioList",
      clearId: "exportFuncionarioClear",
      getData: () => funcionariosCache,
      renderMain: (f) => f.nome,
      renderSub: (f) => f.cargo || "",
      matchFields: (f) => [f.nome, f.cargo, f.matricula],
      onClear: () => {
        document.getElementById("exportFuncionario").value = "todos";
      },
    });
  }

  renderAnalise(analiseCache);
}

function renderAnalise(data) {
  const body = document.getElementById("analiseBody");
  const entries = Object.entries(data).sort((a, b) => diasRestantes(a[1].dataVencimento) - diasRestantes(b[1].dataVencimento));
  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="muted">Nenhum registro encontrado</td></tr>`;
    return;
  }
  body.innerHTML = entries
    .map(([id, e], i) => {
      const sit = situacao(e.dataVencimento);
      return `<tr style="animation-delay:${Math.min(i, 12) * 30}ms">
        <td>${esc(e.funcionarioNome)}</td>
        <td>${esc(e.epiNome)}</td>
        <td>${esc(e.epiRegistro)}</td>
        <td>${formatBR(e.dataEntrega)}</td>
        <td>${formatBR(e.dataVencimento)}</td>
        <td>${diasRestantes(e.dataVencimento)}</td>
        <td><span class="badge ${sit.cls}">${sit.label}</span></td>
      </tr>`;
    })
    .join("");
}

document.getElementById("buscaAnalise").addEventListener("input", (e) => {
  const termo = normaliza(e.target.value);
  const filtrado = Object.fromEntries(
    Object.entries(analiseCache).filter(([id, en]) =>
      [en.funcionarioNome, en.epiNome, en.epiRegistro].some((campo) => normaliza(campo).includes(termo))
    )
  );
  renderAnalise(filtrado);
});

document.getElementById("btnExportar").addEventListener("click", () => {
  const um = document.getElementById("modoUm").checked;
  if (um) {
    const id = document.getElementById("exportFuncionario").value;
    if (!id || id === "todos") {
      alert("Busque e selecione um funcionário na lista antes de gerar a ficha individual.");
      document.getElementById("exportFuncionarioInput").focus();
      return;
    }
    exportarFicha(id);
  } else {
    exportarFicha("todos");
  }
});

/* Gera a ficha para impressão: um funcionário específico ou "todos", escolhido na hora */
async function exportarFicha(alvoId) {
  const printArea = document.getElementById("printArea");
  const dataGeracao = formatBR(todayISO());

  if (alvoId && alvoId !== "todos") {
    const [funcionario, entregas] = await Promise.all([
      dbGet(`funcionarios/${alvoId}`),
      dbGet("entregas", qEqual("funcionarioId", alvoId)),
    ]);
    printArea.innerHTML = montarCabecalhoDoc("Ficha de EPI", dataGeracao) + montarBlocoFicha(funcionario, entregas);
  } else {
    const [funcionarios, entregas] = await Promise.all([dbGet("funcionarios"), dbGet("entregas")]);
    const blocos = Object.entries(funcionarios)
      .sort((a, b) => (a[1].nome || "").localeCompare(b[1].nome || "", "pt-BR"))
      .map(([id, f]) => {
        const entregasFunc = Object.fromEntries(Object.entries(entregas).filter(([eid, e]) => e.funcionarioId === id));
        return montarBlocoFicha(f, entregasFunc);
      })
      .join("");
    printArea.innerHTML = montarCabecalhoDoc("Ficha geral de EPIs — todos os funcionários", dataGeracao) + blocos;
  }

  setTimeout(() => window.print(), 200);
}

/* Cabeçalho único do documento impresso */
function montarCabecalhoDoc(titulo, dataGeracao) {
  return `
    <div class="doc-header">
      <div class="doc-title">
        <span class="doc-mark" aria-hidden="true"></span>
        <h1>${esc(titulo)}</h1>
      </div>
      <p class="sub">Documento gerado em ${dataGeracao} · Controle de EPI</p>
    </div>
  `;
}

/* Um bloco de ficha por funcionário: cabeçalho com resumo, tabela e linhas de assinatura */
function montarBlocoFicha(funcionario, entregas) {
  const lista = Object.values(entregas).sort((a, b) => (a.dataVencimento < b.dataVencimento ? -1 : 1));
  const vencidos = lista.filter((e) => diasRestantes(e.dataVencimento) < 0).length;
  const atencao = lista.filter((e) => {
    const d = diasRestantes(e.dataVencimento);
    return d >= 0 && d <= 30;
  }).length;
  const ok = lista.length - vencidos - atencao;

  const linhas = lista.length
    ? lista
        .map((e) => {
          const sit = situacao(e.dataVencimento);
          return `<tr>
          <td>${esc(e.epiNome)}</td>
          <td class="mono">${esc(e.epiRegistro)}</td>
          <td>${formatBR(e.dataEntrega)}</td>
          <td>${formatBR(e.dataVencimento)}</td>
          <td><span class="sit sit-${sit.cls}">${sit.label}</span></td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" class="ficha-empty">Nenhum EPI entregue até o momento</td></tr>`;

  return `
    <section class="ficha-card">
      <header class="ficha-head">
        <div>
          <h3>${esc(funcionario.nome)}</h3>
          <p class="ficha-meta">${esc(funcionario.cargo) || "Cargo não informado"} · Matrícula ${esc(funcionario.matricula) || "-"}</p>
        </div>
        <div class="ficha-resumo">
          ${ok ? `<span class="chip chip-ok">${ok} em dia</span>` : ""}
          ${atencao ? `<span class="chip chip-atencao">${atencao} a vencer</span>` : ""}
          ${vencidos ? `<span class="chip chip-vencido">${vencidos} vencido(s)</span>` : ""}
          ${!lista.length ? `<span class="chip chip-vazio">sem registros</span>` : ""}
        </div>
      </header>
      <table>
        <thead><tr><th>EPI</th><th>Registro (CA)</th><th>Entrega</th><th>Vencimento</th><th>Situação</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <footer class="ficha-sign">
        <div class="sign-line"><span>Assinatura do funcionário</span></div>
        <div class="sign-line"><span>Responsável pela entrega</span></div>
      </footer>
    </section>
  `;
}

