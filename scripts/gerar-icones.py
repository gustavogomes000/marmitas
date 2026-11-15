"""Recorta a arte original da logo em PNGs com fundo transparente.

Gera public/logo.png (marca completa: panela + D'a Márcia + Marmitaria) e
public/simbolo.png (só a panela com o vapor), além dos ícones do PWA.
Rode:  python scripts/gerar-icones.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "public" / "logo-original.jpg"
SAIDA = RAIZ / "public"

BORGOGNHA = (0x52, 0x10, 0x11)
FUNDO = (74, 14, 16)  # borgonha da arte original, que vira transparência

_cache: dict[str, Image.Image] = {}


_LINHAS: list | None = None


def _linhas(img: Image.Image):
    global _LINHAS
    if _LINHAS is not None:
        return _LINHAS
    pixels = img.load()
    w, h = img.size

    def conteudo(x: int, y: int) -> bool:
        r, g, b = pixels[x, y][:3]
        return max(abs(r - FUNDO[0]), abs(g - FUNDO[1]), abs(b - FUNDO[2])) > 45

    saida = []
    for y in range(h):
        xs = [x for x in range(w) if conteudo(x, y)]
        saida.append((bool(xs), min(xs) if xs else w, max(xs) if xs else 0))
    return saida


def _blocos(linhas) -> list[tuple[int, int, int, int]]:
    """Blocos verticais de traço: (topo, base, esquerda, direita)."""
    h = len(linhas)
    y, saida = 0, []
    while y < h:
        if not linhas[y][0]:
            y += 1
            continue
        inicio = y
        while y < h and linhas[y][0]:
            y += 1
        trecho = linhas[inicio:y]
        saida.append((inicio, y - 1, min(f[1] for f in trecho), max(f[2] for f in trecho)))
    return saida


def _com_alpha(recorte: Image.Image) -> Image.Image:
    rgba = recorte.convert("RGB").copy().convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            d = max(abs(r - FUNDO[0]), abs(g - FUNDO[1]), abs(b - FUNDO[2]))
            t = max(0.0, min(1.0, (d - 45) / 45))
            pixels[x, y] = (r, g, b, int(round(t * t * (3 - 2 * t) * 255)))
    return rgba


def _marca(chave: str, caixa: callable) -> Image.Image:
    if chave not in _cache:
        img = Image.open(FONTE).convert("RGB")
        _cache[chave] = _com_alpha(img.crop(caixa(img)))
    return _cache[chave]


def _caixa(img: Image.Image) -> tuple[int, int, int, int]:
    linhas = _linhas(img)
    blocos = _blocos(linhas)
    x0 = min(b[2] for b in blocos)
    x1 = max(b[3] for b in blocos)
    return (x0, blocos[0][0], x1 + 1, blocos[-1][1] + 1)


def _so_panela(img: Image.Image) -> tuple[int, int, int, int]:
    """Vapor + panela: para no primeiro bloco largo, que já é a tipografia."""
    linhas = _linhas(img)
    w = img.width
    pegados = []
    for inicio, fim, esquerda, direita in _blocos(linhas):
        if direita - esquerda > w * 0.40:
            break
        pegados.append((inicio, fim, esquerda, direita))
    return (min(b[2] for b in pegados), pegados[0][0], max(b[3] for b in pegados) + 1, pegados[-1][1] + 1)


def _lettering(img: Image.Image) -> tuple[int, int, int, int]:
    """O 'D'a Márcia' manuscrito, recorte puro da arte original."""
    linhas = _linhas(img)
    w = img.width
    for inicio, fim, esquerda, direita in _blocos(linhas):
        if direita - esquerda > w * 0.40:
            return (esquerda, inicio, direita + 1, fim + 1)
    raise SystemExit("lettering não encontrado")


def _escala_cabendo(marca: Image.Image, alvo: int) -> Image.Image:
    escala = alvo / max(marca.width, marca.height)
    return marca.resize((max(1, round(marca.width * escala)), max(1, round(marca.height * escala))), Image.LANCZOS)


def salvar_arquivo(nome: str, marca: Image.Image, margem: float) -> None:
    lado = max(marca.width, marca.height) + 2 * max(1, round(max(marca.width, marca.height) * margem))
    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.alpha_composite(marca, ((lado - marca.width) // 2, (lado - marca.height) // 2))
    tela.save(SAIDA / nome)
    print("gerado", nome, f"{lado}x{lado}")


def icone(arquivo: str, tamanho: int, proporcao: float, forma: str) -> None:
    marca = _escala_cabendo(_marca("panela", _so_panela), tamanho * proporcao)
    tela = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    ImageDraw.Draw(tela).rectangle([0, 0, tamanho, tamanho], fill=BORGOGNHA + (255,))
    if forma != "quadrado":
        mascara = Image.new("L", (tamanho, tamanho), 0)
        ImageDraw.Draw(mascara).rounded_rectangle(
            [0, 0, tamanho - 1, tamanho - 1],
            radius=tamanho // 2 if forma == "circulo" else int(tamanho * 0.225),
            fill=255,
        )
        tela.putalpha(mascara)
    tela.alpha_composite(marca, ((tamanho - marca.width) // 2, (tamanho - marca.height) // 2))
    tela.save(SAIDA / arquivo)
    print("gerado", arquivo, f"{tamanho}x{tamanho}")


if __name__ == "__main__":
    salvar_arquivo("logo.png", _marca("logo", _caixa), 0.02)
    salvar_arquivo("simbolo.png", _marca("panela", _so_panela), 0.02)
    salvar_arquivo("lettering.png", _marca("lettering", _lettering), 0.02)
    icone("marca-192.png", 192, 0.74, "arredondado")
    icone("marca-512.png", 512, 0.74, "arredondado")
    icone("marca-maskable-512.png", 512, 0.62, "quadrado")
    icone("apple-touch-icon.png", 180, 0.62, "quadrado")
    icone("pwa-64x64.png", 64, 0.86, "circulo")
