/**
 * Gets the completed transcripts by combining transcript data and filtering invalid entries
 */
export const getCompletedTranscripts = (transcripts) => {
  return transcripts.filter(
    (transcript) =>
      transcript.hasMetadata &&
      transcript.hasTranslation &&
      (transcript.languageCode === "eng" || transcript.languageCode === "spa")
  );
};
