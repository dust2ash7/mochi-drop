(() => {
  const s = document.currentScript;
  const v = (s && s.src && s.src.split("v=")[1]) || "5";
  Promise.all([
    fetch("script.gz.b64.a?v=" + v).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch("script.gz.b64.b?v=" + v).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
  ]).then(async ([a, b]) => {
    const bin = Uint8Array.from(atob((a + b).replace(/\s+/g, "")), c => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([bin]).stream().pipeThrough(ds);
    const text = await new Response(stream).text();
    (0, eval)(text);
  }).catch(e => console.error("Mochi Drop load failed", e));
})();
