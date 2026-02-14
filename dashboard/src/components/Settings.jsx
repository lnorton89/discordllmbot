import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  TextField,
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
  Tabs,
  Tab,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Api as LLMIcon,
  Storage as StorageIcon,
  Visibility as VisibilityIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Gavel as GavelIcon,
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
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [activeSpeakingSection, setActiveSpeakingSection] =
    useState("globalRules"); // Default to global rules open

  // Debounce timer reference
  const debounceTimer = useRef(null);

  useEffect(() => {
    fetchConfig().then((initialConfig) => {
      if (initialConfig) {
        fetchModels(initialConfig.api?.provider || "gemini");
      }
    });

    // Cleanup on unmount
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get("/api/config");
      setConfig(res.data);
      return res.data; // Return the fetched config
    } catch (err) {
      console.error("Failed to fetch config", err);
      setMessage({
        open: true,
        text: "Failed to load configuration.",
        severity: "error",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async (explicitProvider) => {
    const providerToFetch = explicitProvider || config?.api?.provider;
    if (!providerToFetch) return []; // Don't fetch if provider isn't set yet

    setIsFetchingModels(true);
    try {
      const res = await axios.get("/api/models", {
        params: { provider: providerToFetch },
      });
      setModels(res.data);
      return res.data; // Return the models
    } catch (err) {
      console.error("Failed to fetch models", err);
      setMessage({
        open: true,
        text: `Could not fetch models from the ${providerToFetch} API.`,
        severity: "warning",
      });
      // Don't set a fallback, let the user know there's an issue.
      setModels([]);
      return []; // Return empty array on error
    } finally {
      setIsFetchingModels(false);
    }
  };

  const saveConfig = async (newConfig) => {
    setSaving(true);
    try {
      await axios.post("/api/config", newConfig);
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

  // Debounced save function to prevent spamming the server
  const debouncedSave = (newConfig) => {
    // Clear the existing timer if there is one
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set a new timer to save after 1000ms (1 second)
    debounceTimer.current = setTimeout(() => {
      saveConfig(newConfig);
    }, 1000);
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

      // Trigger debounced save
      debouncedSave(newConfig);

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

      const currentArray = current[lastKey];
      if (
        currentArray.length > 0 &&
        currentArray[currentArray.length - 1] === ""
      ) {
        return newConfig;
      }
      current[lastKey] = [...currentArray, item];
      return newConfig;
    });
  };

  const removeArrayItem = (path, itemToRemove) => {
    setConfig((prev) => {
      const newConfig = { ...prev };
      let current = newConfig;
      const keys = path.split(".");
      const lastKey = keys.pop();
      for (const key of keys) current = current[key];

      current[lastKey] = [...current[lastKey]].filter(
        (item) => item !== itemToRemove,
      );
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

      // Trigger debounced save
      debouncedSave(newConfig);

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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSpeakingSectionChange = (section) => {
    // Always switch to the clicked section (this creates the linked behavior)
    setActiveSpeakingSection(section);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        {saving && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="textSecondary">
              Saving...
            </Typography>
          </Box>
        )}
      </Box>

      <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            backgroundColor: "background.paper",
          }}
        >
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PersonIcon fontSize="small" />
                <span>Bot Persona</span>
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LLMIcon fontSize="small" />
                <span>LLM</span>
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <StorageIcon fontSize="small" />
                <span>Memory</span>
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <VisibilityIcon fontSize="small" />
                <span>Logger</span>
              </Box>
            }
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Bot Persona Tab */}
          {activeTab === 0 && (
            <>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: "0.9rem",
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                Bot Persona
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Global Bot Name"
                    helperText="The name used for the Discord application"
                    value={config.bot.name}
                    onChange={(e) => updateNested("bot.name", e.target.value)}
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Global Username"
                    helperText="The username used for the Discord application"
                    value={config.bot.username}
                    onChange={(e) =>
                      updateNested("bot.username", e.target.value)
                    }
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Default Persona Description"
                    helperText="Baseline description for new servers"
                    multiline
                    rows={3}
                    value={config.bot.description}
                    onChange={(e) =>
                      updateNested("bot.description", e.target.value)
                    }
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Accordion
                      expanded={activeSpeakingSection === "globalRules"}
                      onChange={() =>
                        handleSpeakingSectionChange("globalRules")
                      }
                      sx={{
                        "&.Mui-expanded": {
                          margin: 0,
                        },
                        "&:before": {
                          display: "none",
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<KeyboardArrowDownIcon />}
                        sx={{
                          pl: 2,
                          pr: 2,
                          backgroundColor: "secondary.main",
                          color: "secondary.contrastText",
                          borderRadius: 1,
                          "&.Mui-expanded": {
                            borderRadius: "8px 8px 0 0",
                          },
                        }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <GavelIcon fontSize="small" />
                          <Typography variant="subtitle2" color="inherit">
                            Global Rules
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pl: 2, pr: 2, pt: 2, pb: 2 }}>
                        {config.bot.globalRules.map((rule, index) => (
                          <Box
                            key={index}
                            sx={{ display: "flex", gap: 1, mb: 1 }}
                          >
                            <TextField
                              fullWidth
                              size="small"
                              value={rule}
                              onChange={(e) =>
                                updateArrayItem(
                                  "bot.globalRules",
                                  index,
                                  e.target.value,
                                )
                              }
                              variant="outlined"
                            />
                            <IconButton
                              color="error"
                              onClick={() =>
                                removeArrayItem("bot.globalRules", index)
                              }
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
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                </Grid>
              </Grid>
            </>
          )}

          {/* API Settings Tab */}
          {activeTab === 1 && (
            <>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: "0.9rem",
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                LLM Settings
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Provider</InputLabel>
                    <Select
                      value={config.api.provider || "gemini"}
                      label="Provider"
                      onChange={async (e) => {
                        const newProvider = e.target.value;
                        updateNested("api.provider", newProvider);
                        // Reset model selection when switching providers
                        if (newProvider === "gemini") {
                          updateNested("api.geminiModel", "gemini-2.0-flash");
                          await fetchModels(newProvider); // Fetch models for the new provider
                        } else if (newProvider === "ollama") {
                          // Fetch models first, then set the first available model
                          const fetchedModels = await fetchModels(newProvider);
                          if (fetchedModels && fetchedModels.length > 0) {
                            updateNested("api.ollamaModel", fetchedModels[0]);
                          } else {
                            // If no models are available, set to empty string
                            updateNested("api.ollamaModel", "");
                          }
                        } else {
                          await fetchModels(newProvider); // Fetch models for the new provider
                        }
                      }}
                    >
                      <MenuItem value="gemini">Google Gemini</MenuItem>
                      <MenuItem value="ollama">Ollama (Local)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {config.api.provider === "ollama" ? (
                    <FormControl fullWidth disabled={isFetchingModels}>
                      <InputLabel>Ollama Model</InputLabel>
                      <Select
                        value={
                          models.includes(config.api.ollamaModel)
                            ? config.api.ollamaModel
                            : ""
                        }
                        label="Ollama Model"
                        onChange={(e) =>
                          updateNested("api.ollamaModel", e.target.value)
                        }
                      >
                        {isFetchingModels ? (
                          <MenuItem value="">
                            <CircularProgress size={20} />
                          </MenuItem>
                        ) : models.length === 0 ? (
                          <MenuItem value="" disabled>
                            No models available
                          </MenuItem>
                        ) : (
                          models.map((m) => (
                            <MenuItem key={m} value={m}>
                              {m}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  ) : (
                    <FormControl fullWidth disabled={isFetchingModels}>
                      <InputLabel>Gemini Model</InputLabel>
                      <Select
                        value={
                          models.includes(config.api.geminiModel)
                            ? config.api.geminiModel
                            : ""
                        }
                        label="Gemini Model"
                        onChange={(e) =>
                          updateNested("api.geminiModel", e.target.value)
                        }
                      >
                        {isFetchingModels ? (
                          <MenuItem value="">
                            <CircularProgress size={20} />
                          </MenuItem>
                        ) : models.length === 0 ? (
                          <MenuItem value="" disabled>
                            No models available
                          </MenuItem>
                        ) : (
                          models.map((m) => (
                            <MenuItem key={m} value={m}>
                              {m}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Retry Attempts"
                    value={config.api.retryAttempts}
                    onChange={(e) =>
                      updateNested(
                        "api.retryAttempts",
                        parseInt(e.target.value),
                      )
                    }
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Retry Backoff (ms)"
                    value={config.api.retryBackoffMs}
                    onChange={(e) =>
                      updateNested(
                        "api.retryBackoffMs",
                        parseInt(e.target.value),
                      )
                    }
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* Memory Settings Tab */}
          {activeTab === 2 && (
            <>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: "0.9rem",
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                Memory Settings
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Memory (Messages)"
                    value={config.memory.maxMessages}
                    onChange={(e) =>
                      updateNested(
                        "memory.maxMessages",
                        parseInt(e.target.value),
                      )
                    }
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Message Age (Days)"
                    value={config.memory.maxMessageAgeDays}
                    onChange={(e) =>
                      updateNested(
                        "memory.maxMessageAgeDays",
                        parseInt(e.target.value),
                      )
                    }
                    variant="outlined"
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* Logger Settings Tab */}
          {activeTab === 3 && (
            <>
              <Typography
                variant="h6"
                gutterBottom
                component="div"
                sx={{
                  fontSize: "0.9rem",
                  color: "text.secondary",
                  mb: 2,
                }}
              >
                Logger Settings
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Log Lines"
                    value={config.logger.maxLogLines}
                    onChange={(e) =>
                      updateNested(
                        "logger.maxLogLines",
                        parseInt(e.target.value),
                      )
                    }
                    variant="outlined"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.logger.logReplyDecisions}
                        onChange={(e) =>
                          updateNested(
                            "logger.logReplyDecisions",
                            e.target.checked,
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Log Reply Decisions"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.logger.logSql}
                        onChange={(e) =>
                          updateNested("logger.logSql", e.target.checked)
                        }
                        color="primary"
                      />
                    }
                    label="Log SQL Queries"
                  />
                </Grid>
              </Grid>
            </>
          )}
        </Box>
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
