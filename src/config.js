const config = {
  togetherApiKey: process.env.REACT_APP_TOGETHER_API_KEY,
  isDevelopment: process.env.NODE_ENV === 'development',
};

if (!config.togetherApiKey) {
  console.error('Together AI API key is not set in environment variables');
}

export default config; 