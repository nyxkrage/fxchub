import { Hono } from 'hono'
import { stream } from 'hono/streaming'

import Handlebars from 'handlebars'

const template = Handlebars.compile(`
<html>
  <head>
    <meta property="og:title" content="{{char}} by {{creator}} ({{tokens}} tokens, {{likes}} likes)" />
    <meta property="og:description" content="{{description}}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://fxchub.ai/images/{{creator}}/{{character}}.png" />
    <meta name="twitter:card" content="summary_large_image">
    <meta property="og:url" content="{{url}}" />
  </head>
</html>`)

const home = `
<html>
  <body>
    <h1>fxchub - enables discord embeds for chub cards</h1>
    <p>No logs are kept, see source at htttps://github.com/NyxKrage/fxchub</p>
    <form>
      <h2>Preferred Site, where fxchub will redirect you to</h2>
      <label>
        <input type="radio" name="site" value="chub.ai" onclick="setSiteCookie('chub.ai')" id="chub"> chub.ai
      </label>
      <label>
        <input type="radio" name="site" value="characterhub.org" onclick="setSiteCookie('characterhub.org')" id="characterhub"> characterhub.org
      </label>
    </form>
    <script>
      function setSiteCookie(site) {
        document.cookie = "preferredSite=" + site + "; path=/";
      }

      function getCookie(name) {
        return Object.fromEntries(document.cookie.split(";").map(ck => ck.split("=", 2).map(v => v.trim())))[name]
      }

      window.onload = function() {
        const preferredSite = getCookie('preferredSite') || 'chub.ai';
        document.getElementById(preferredSite === 'chub.ai' ? 'chub' : 'characterhub').checked = true;
      }
    </script>
  </body>
</html>
`

const app = new Hono()

app.get('/', (c) => {
  return c.html(home)
})

app.get('/characters/:creator/:character', async (c) => {
  let { creator, character } = c.req.param()
  character = character.replace(/\/$/, "")

  if (!c.req.header("User-Agent")?.includes("Discordbot")) {
    const preferredSite = Object.fromEntries(c.req.header("Cookie")?.split(";")?.map(ck => ck.split("=", 2).map(v => v.trim())) ?? [])["preferredSite"] ?? "chub.ai"
    const url = `https://${preferredSite}/characters/${creator}/${character}`
    return c.redirect(url)
  }

  const url = `https://chub.ai/characters/${creator}/${character}`
  let char_obj
  try {
    // cloudflare proxy bypass
    const response = await fetch("http://pid1.sh:8191/v1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("CF_KEY") ?? "CF_KEY_HERE"}`
      },
      body: JSON.stringify({
        cmd: "request.get",
        url: `https://api.chub.ai/api/characters/${creator}/${character}?full=true`,
        timeout: 6000,
      })
    });
    char_obj = await response.json()
    char_obj = char_obj.solution.response as string
    char_obj = "{" + char_obj.split("}").slice(0, -1).join("}").split("{").slice(1).join("{") + "}"
    char_obj = JSON.parse(char_obj)
  } catch (error) {
    console.error(error);
    return c.status(500)
  }

  const html = template({
    url,
    char: char_obj.node.name,
    creator,
    character,
    likes: char_obj.node.n_favorites,
    description: char_obj.node.tagline,
    tokens: JSON.parse(char_obj.node.labels.find(label => label.title === "TOKEN_COUNTS").description).total
  })

  return c.html(html)
})

app.get("/images/:creator/:character", (c) => {
  let { creator, character } = c.req.param()
  character = character.replace(/\.[^/.]+$/, "");

  return stream(c, async (stream) => {
    const response = await fetch(`https://avatars.charhub.io/avatars/${creator}/${character}/chara_card_v2.png`)
    if (response.status !== 200) {
      console.error(response)
      return c.status(500);
    }
    await stream.pipe(response.body!)
  })
})

export default app
