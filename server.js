import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const SILICONFLOW_BASE_URL =
  process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1";
const SILICONFLOW_MODEL =
  process.env.SILICONFLOW_MODEL || "Qwen/Qwen2.5-72B-Instruct";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item.content === "string")
    .slice(-8)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content.slice(0, 2000)
    }));
}

app.post("/api/chat", async (req, res) => {
  try {
    if (!SILICONFLOW_API_KEY) {
      return res.status(500).json({
        error:
          "服务器没有配置 SILICONFLOW_API_KEY。请在 Render 的 Environment Variables 中添加 SILICONFLOW_API_KEY。"
      });
    }

    const { message, history } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message 不能为空。" });
    }

    const messages = [
      {
        role: "system",
        content:
          "你是一个电气工程及其自动化专业学习助手。你要用中文回答，表达清晰、结构化、适合本科生理解。你擅长讲解工程电磁场、电机学、模拟电子技术、数字电子技术、电力系统分析、电力电子技术、自动控制原理、新型电力系统、储能、智能电网等内容。回答时尽量结合直观类比、公式含义、工程应用和学习建议。"
      },
      ...normalizeHistory(history),
      {
        role: "user",
        content: message.slice(0, 4000)
      }
    ];

    const apiUrl = `${SILICONFLOW_BASE_URL.replace(/\/$/, "")}/chat/completions`;

    const sfResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: SILICONFLOW_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1200,
        stream: false
      })
    });

    const data = await sfResponse.json();

    if (!sfResponse.ok) {
      console.error("SiliconFlow API error:", data);
      return res.status(sfResponse.status).json({
        error:
          data?.error?.message ||
          data?.message ||
          "硅基流动 API 调用失败。请检查 API Key、模型名、账号额度和 base url。"
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.delta?.content ||
      "模型没有返回文本内容。";

    res.json({ reply });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "服务器内部错误，请稍后再试。"
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EEA SiliconFlow AI website is running on port ${PORT}`);
});