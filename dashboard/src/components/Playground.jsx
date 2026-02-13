import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Send as SendIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

function Playground({ messages: propMessages, setMessages: propSetMessages }) {
  const [localMessages, setLocalMessages] = useState([]);

  const messages = propMessages || localMessages;
  const setMessages = propSetMessages || setLocalMessages;

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const theme = useTheme();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);
    setError(null);

    // Add user message to the chat
    const userMsg = {
      id: Date.now(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
      username: "You",
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Get bot info for the playground
      const botInfo = await axios.get("/api/bot-info");
      const botName = botInfo.data.clientId ? "DiscordLLMBot" : "Bot";

      // Send message to the chat API
      const response = await axios.post("/api/chat", {
        message: userMessage,
        username: "You",
        guildName: "Playground Server",
      });

      // Add bot response to the chat
      const botMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.data.reply,
        timestamp: response.data.timestamp,
        username: botName,
        usage: response.data.usage,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Failed to get response:", err);
      setError("Failed to get response from bot. Please try again.");

      // Add error message to the chat
      const errorMsg = {
        id: Date.now() + 1,
        role: "system",
        content: "Error: Failed to get response from bot.",
        timestamp: new Date().toISOString(),
        username: "System",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press (Enter to send, Shift+Enter for new line)
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const handleClearChat = () => {
    setMessages([]);
    setError(null);
  };

  // Get bot avatar color based on theme
  const getAvatarColor = (role) => {
    switch (role) {
      case "user":
        return theme.palette.primary.main;
      case "assistant":
        return theme.palette.secondary.main;
      case "system":
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <Box sx={{ width: "100%",
         display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 110px)",
        p: 2,
     }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          mb: 3,
        }}
      >

        <Tooltip title="Clear Chat">
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={handleClearChat}
          >
            Clear Chat
          </Button>
        </Tooltip>
      </Box>

      <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* Messages container */}
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2,
            bgcolor: theme.palette.mode === "light" ? "grey.50" : "grey.900",
          }}
        >
          {messages.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
              }}
            >
              <Typography variant="h6" gutterBottom>
                Welcome to the Bot Playground
              </Typography>
              <Typography variant="body2" align="center">
                Chat with the bot directly in your browser to test personas and
                prompts.
                <br />
                Your messages are not sent to any Discord servers.
              </Typography>
            </Box>
          ) : (
            <List sx={{ width: "100%" }}>
              {messages.map((message, index) => (
                <Box key={message.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getAvatarColor(message.role) }}>
                        {message.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography
                            variant="subtitle2"
                            component="span"
                            sx={{
                              fontWeight:
                                message.role === "assistant"
                                  ? "bold"
                                  : "normal",
                              color:
                                message.role === "assistant"
                                  ? "secondary.main"
                                  : "text.primary",
                            }}
                          >
                            {message.username}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(message.timestamp), {
                              addSuffix: true,
                            })}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography
                            variant="body1"
                            component="div"
                            sx={{
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {message.content}
                          </Typography>
                          {message.usage && (
                            <Box sx={{ mt: 1 }}>
                              <Chip
                                label={`Tokens: ${message.usage.promptTokenCount || 0} → ${message.usage.candidatesTokenCount || 0}`}
                                size="small"
                                variant="outlined"
                              />
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < messages.length - 1 && <Divider />}
                </Box>
              ))}
              {isLoading && (
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>
                      <CircularProgress size={20} color="inherit" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText>
                    <Typography variant="body1">Bot is thinking...</Typography>
                  </ListItemText>
                </ListItem>
              )}
              <div ref={messagesEndRef} />
            </List>
          )}
        </Box>

        {/* Input area */}
        <Paper sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              disabled={isLoading}
              variant="outlined"
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                },
                "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "secondary.main",
                },
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              variant="contained"
              sx={{ 
                borderRadius: 2,
                backgroundColor: "secondary.main",
                "&:hover": {
                  backgroundColor: "secondary.dark",
                },
              }}
              endIcon={<SendIcon />}
            >
              Send
            </Button>
          </Box>
          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </Paper>
      </Paper>
    </Box>
  );
}

export default Playground;
