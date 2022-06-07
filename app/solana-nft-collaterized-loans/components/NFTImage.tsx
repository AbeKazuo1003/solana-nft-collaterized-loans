import * as React from "react";
import {useEffect, useState} from "react";
import {Metadata} from "@metaplex-foundation/mpl-token-metadata";
import {Account} from "@metaplex-foundation/mpl-core";
import {Stack} from "@mui/material";

const NFTImage = (props: any) => {
    const {nft, program} = props;
    const [data, setData] = useState<any>(null);
    const [imageSrc, setImage] = useState(null);


    useEffect(() => {
        const loadImageData = async (uri: string) => {
            const response = await fetch(uri);
            const {image} = await response.json();
            setImage(image);
        };

        const getMetadata = async () => {
            const metadataPDA = await Metadata.getPDA(nft);
            const mintAccInfo = await program.provider.connection.getAccountInfo(metadataPDA);

            // @ts-ignore
            const {data: {data: metadata}} = Metadata.from(new Account(nft, mintAccInfo));

            await loadImageData(metadata.uri);
            setData(metadata);
        };

        getMetadata();
    }, [nft]);

    return (
        <Stack direction={"row"} justifyContent={"center"} alignItems={"center"}>
            <img src={imageSrc ?? ''} alt={data?.name} style={{width: "100px", height: "100px"}}/>
        </Stack>
    );
}

export default NFTImage;