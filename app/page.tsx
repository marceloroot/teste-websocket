"use client";
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3333");

const App: React.FC = () => {
  const [transcription, setTranscription] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false); // Estado para controlar o status da gravação
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  const sendAudio = async () => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
      const audioArrayBuffer = await audioBlob.arrayBuffer();
      console.log("ArrayBuffer size:", audioArrayBuffer.byteLength);
      audioChunksRef.current = []; // Limpar os chunks de áudio

      socket.emit("audio-stream", {
        audio: audioArrayBuffer,
        currentText: transcription, // Enviando a transcrição atual junto com o áudio
      });
    }
  };

  const lookForSymptoms = async (text: string) => {
    socket.emit("look-for-symptoms", {
      text,
    });
  };

  const startRecording = async () => {
    setTranscription(""); // Limpar a transcrição
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstart = () => {
      console.log("Recording started");
      setIsRecording(true); // Atualizar estado para gravando
    };

    mediaRecorder.onstop = () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      sendAudio(); // Enviar quaisquer dados de áudio restantes
      setIsRecording(false); // Atualizar estado para não gravando
    };

    mediaRecorder.start(); // Iniciar gravação
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  useEffect(() => {
    // Listener para transcrição
    socket.on("transcription-result", (transcription: string) => {
      console.log("Received transcription:", transcription);
      setTranscription(transcription);
      lookForSymptoms(transcription); // Analisar sintomas na transcrição recebida
    });

    // Listener para erros de transcrição
    socket.on("transcription-error", (error: string) => {
      setTranscription(`Error: ${error}`);
    });

    // Listener para sintomas identificados
    socket.on("symptoms-result", (data: { Symptoms: string[] }) => {
      if (data && data.Symptoms) {
        console.log("Symptoms result:", data.Symptoms);
        setSymptoms(JSON.stringify(data.Symptoms));
      }
    });

    return () => {
      socket.off("transcription-result");
      socket.off("transcription-error");
      socket.off("symptoms-result");
    };
  }, []);

  return (
    <div>
      <h1>Real-Time Audio Transcription</h1>
      <button
        onClick={startRecording}
        style={{
          padding: "1rem",
          backgroundColor: isRecording ? "#ccc" : "#4CAF50", // Verde quando não estiver gravando
          color: isRecording ? "#000" : "#fff", // Texto branco quando não está gravando
          cursor: isRecording ? "not-allowed" : "pointer", // Desativado enquanto grava
          border: "none",
          borderRadius: "5px",
          marginRight: "10px",
        }}
        disabled={isRecording} // Desabilitar enquanto estiver gravando
      >
        Start Recording
      </button>
      <button
        onClick={stopRecording}
        style={{
          padding: "1rem",
          backgroundColor: isRecording ? "#f44336" : "#ccc", // Vermelho quando estiver gravando
          color: "#fff",
          cursor: !isRecording ? "not-allowed" : "pointer", // Desativado se não estiver gravando
          border: "none",
          borderRadius: "5px",
        }}
        disabled={!isRecording} // Desabilitar se não estiver gravando
      >
        Stop Recording
      </button>
      <div id="transcription">
        <h3>Transcription:</h3>
        <p>{transcription}</p>
      </div>
      <div id="symptoms">
        <h3>Symptoms Detected:</h3>
        <p>{symptoms}</p>
      </div>
    </div>
  );
};

export default App;
