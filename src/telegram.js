export const sendTelegramMessage = async (message) => {
  const botToken = "7939206394:AAH4a_LeAR4WG3Igdk4tq6MUpkBpu6hwcXc";
  const chatId = "-4514121928";

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending telegram message:", error);
    throw error;
  }
};
