import { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
  Slider,
} from "@mui/material";
import {
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({
    open: false,
    text: "",
    severity: "success",
  });
  const [models, setModels] = useState([]);

  useEffect(() => {
    fetchConfig();
    fetchModels();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get("/api/config");
      setConfig(res.data);
    } catch (err) {
      console.error("Failed to fetch config", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await axios.get("/api/models");
      setModels(res.data);
    } catch (err) {
      console.error("Failed to fetch models", err);
      setModels(["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post("/api/config", config);
      setMessage({
        open: true,
        text: "Settings saved successfully!",
        severity: "success",
      });
    } catch (err) {
      console.error("Failed to save config", err);
      setMessage({
        open: true,
        text: "Error saving settings.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateNested = (path, value) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current = newConfig;
      const keys = path.split(".");
      const lastKey = keys.pop();

      for (const key of keys) {
        current[key] = { ...current[key] };
        current = current[key];
      }
      current[lastKey] = value;
      return newConfig;
    });
  };

  const addArrayItem = (path, item = "") => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current = newConfig;
      const keys = path.split(".");
      const lastKey = keys.pop();
      for (const key of keys) current = current[key];

      current[lastKey] = [...current[lastKey], item];
      return newConfig;
    });
  };

  const removeArrayItem = (path, index) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current = newConfig;
      const keys = path.split(".");
      const lastKey = keys.pop();
      for (const key of keys) current = current[key];

      current[lastKey] = current[lastKey].filter((_, i) => i !== index);
      return newConfig;
    });
  };

  const updateArrayItem = (path, index, value) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current = newConfig;
      const keys = path.split(".");
      const lastKey = keys.pop();
      for (const key of keys) current = current[key];

      const newArray = [...current[lastKey]];
      newArray[index] = value;
      current[lastKey] = newArray;
      return newConfig;
    });
  };

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (!config)
    return <Alert severity="error">Failed to load configuration.</Alert>;

  return (
    <Box sx={{ width: "100%", maxWidth: 800 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h5" fontWeight="bold" color="primary">
          Configuration
        </Typography>
        <Button
          variant="contained"
          startIcon={
            saving ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          Bot Persona
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Bot Name"
              value={config.bot.name}
              onChange={(e) => updateNested("bot.name", e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Username"
              value={config.bot.username}
              onChange={(e) => updateNested("bot.username", e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={config.bot.description}
              onChange={(e) => updateNested("bot.description", e.target.value)}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Speaking Style
            </Typography>
            {config.bot.speakingStyle.map((style, index) => (
              <Box key={index} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={style}
                  onChange={(e) =>
                    updateArrayItem("bot.speakingStyle", index, e.target.value)
                  }
                  variant="outlined"
                />
                <IconButton
                  color="error"
                  onClick={() => removeArrayItem("bot.speakingStyle", index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => addArrayItem("bot.speakingStyle")}
            >
              Add Style
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Global Rules
            </Typography>
            {config.bot.globalRules.map((rule, index) => (
              <Box key={index} sx={{ display: "flex", gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={rule}
                  onChange={(e) =>
                    updateArrayItem("bot.globalRules", index, e.target.value)
                  }
                  variant="outlined"
                />
                <IconButton
                  color="error"
                  onClick={() => removeArrayItem("bot.globalRules", index)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => addArrayItem("bot.globalRules")}
            >
              Add Rule
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          API & Memory
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Gemini Model</InputLabel>
              <Select
                value={config.api.geminiModel}
                label="Gemini Model"
                onChange={(e) =>
                  updateNested("api.geminiModel", e.target.value)
                }
              >
                {models.map((m) => (
                  <MenuItem key={m} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="number"
              label="Max Memory (Messages)"
              value={config.memory.maxMessages}
              onChange={(e) =>
                updateNested("memory.maxMessages", parseInt(e.target.value))
              }
              variant="outlined"
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom color="primary">
          Reply Behavior
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Mode</InputLabel>
              <Select
                value={config.replyBehavior.mode}
                label="Mode"
                onChange={(e) =>
                  updateNested("replyBehavior.mode", e.target.value)
                }
              >
                <MenuItem value="mention-only">Mention Only</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="passive">Passive</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ px: 1 }}>
              <Typography gutterBottom variant="caption">
                Reply Probability: {config.replyBehavior.replyProbability}
              </Typography>
              <Slider
                value={config.replyBehavior.replyProbability}
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                onChange={(e, val) =>
                  updateNested("replyBehavior.replyProbability", val)
                }
              />
            </Box>
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.replyBehavior.requireMention}
                  onChange={(e) =>
                    updateNested(
                      "replyBehavior.requireMention",
                      e.target.checked,
                    )
                  }
                  color="primary"
                />
              }
              label="Require Mention (Always)"
            />
          </Grid>
        </Grid>
      </Paper>

      <Snackbar
        open={message.open}
        autoHideDuration={4000}
        onClose={() => setMessage({ ...message, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={message.severity}
          variant="filled"
          onClose={() => setMessage({ ...message, open: false })}
        >
          {message.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Settings;
