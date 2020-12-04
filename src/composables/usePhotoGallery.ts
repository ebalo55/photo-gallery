import {CameraPhoto, CameraResultType, CameraSource, Capacitor, FilesystemDirectory, Plugins} from "@capacitor/core";
import { ref, watch, onMounted } from 'vue'
import { isPlatform } from '@ionic/vue'

const PHOTO_STORAGE = "photos"

export function usePhotoGallery() {
    const { Camera, Filesystem, Storage } = Plugins;

    const convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
        const reader = new FileReader;
        reader.onerror = reject;
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });

    const savePicture = async (photo: CameraPhoto, fileName: string): Promise<Photo> => {
        let base64Data: string
        if(isPlatform("hybrid")) {
            const file = await Filesystem.readFile({
                path: photo.path!
            })
            base64Data = file.data
        }
        else {
            const response = await fetch(photo.webPath!)
            const blob = await response.blob()
            base64Data = await convertBlobToBase64(blob) as string
        }


        const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: FilesystemDirectory.Data
        })

        if(isPlatform("hybrid")) {
            return {
                filepath: savedFile.uri,
                webviewPath: Capacitor.convertFileSrc(savedFile.uri)
            }
        }
        return {
            filepath: fileName,
            webviewPath: photo.webPath
        }
    }

    const photos = ref<Photo[]>([])

    const cachePhotos = () => {
        Storage.set({
            key: PHOTO_STORAGE,
            value: JSON.stringify(photos.value)
        })
    }

    const takePhoto = async () => {
        const cameraPhoto = await Camera.getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100
        })

        const fileName = new Date().getTime() + '.jpeg'
        const savedFileImage = await savePicture(cameraPhoto, fileName)

        photos.value = [savedFileImage, ...photos.value]
    }

    const loadSaved = async () => {
        const photoList = await Storage.get({ key: PHOTO_STORAGE })
        const photosInStorage = photoList.value ? JSON.parse(photoList.value) : []

        if(!isPlatform("hybrid")) {
            for(const photo of photosInStorage) {
                const file = await Filesystem.readFile({
                    path: photo.filepath,
                    directory: FilesystemDirectory.Data
                })
                photo.webviewPath = `data:image/jpeg;base64,${file.data}`;
            }
        }


        photos.value = photosInStorage
    }

    watch(photos, cachePhotos)
    onMounted(loadSaved)

    return {
        takePhoto,
        photos
    }
}

export interface Photo {
    filepath: string;
    webviewPath?: string;
}