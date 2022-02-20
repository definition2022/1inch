const { ether, expectRevert, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

// const NFTMock = artifacts.require('NFTMock');
const TokenMock = artifacts.require('TokenMock');
const LimitOrderProtocol = artifacts.require('LimitOrderProtocol');
const AggregatorMock = artifacts.require('AggregatorMock');

const { buildOrderData } = require('./helpers/orderUtils');
const { toBN, cutLastArg } = require('./helpers/utils');

describe('NFTickets', async function () {
    let _, wallet, addr1;
    const privatekey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const account = Wallet.fromPrivateKey(Buffer.from(privatekey, 'hex'));

    function buildInverseWithSpread (inverse, spread) {
        return toBN(spread).setn(255, inverse).toString();
    }

    // function buildSinglePriceGetter (swap, oracle, inverse, spread, amount = '0') {
    //    return swap.contract.methods.singlePrice(oracle.address, buildInverseWithSpread(inverse, spread), amount).encodeABI();
    // }

    // eslint-disable-next-line no-unused-vars
    function buildDoublePriceGetter (swap, oracle1, oracle2, spread, amount = '0') {
        return swap.contract.methods.doublePrice(oracle1.address, oracle2.address, buildInverseWithSpread(false, spread), '0', amount).encodeABI();
    }

    function buildOrder (
        salt,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerGetter,
        takerGetter,
        allowedSender = constants.ZERO_ADDRESS,
        predicate = '0x',
        permit = '0x',
        interaction = '0x',
    ) {
        return {
            salt: salt,
            makerAsset: makerAsset.address,
            takerAsset: takerAsset.address,
            maker: wallet,
            receiver: constants.ZERO_ADDRESS,
            allowedSender,
            makingAmount,
            takingAmount,
            makerAssetData: '0x',
            takerAssetData: '0x',
            getMakerAmount: makerGetter,
            getTakerAmount: takerGetter,
            predicate,
            permit,
            interaction,
        };
    }

    before(async function () {
        [_, wallet, addr1] = await web3.eth.getAccounts();
    });

    beforeEach(async function () {
        this.dai = await TokenMock.new('DAI', 'DAI');
        this.weth = await TokenMock.new('WETH', 'WETH');
        this.inch = await TokenMock.new('1INCH', '1INCH');
        this.ticketNFT = await TokenMock.new('Morgenshtern', 'MORG');// await NFTMock.new("Morgenshtern", "MORG");
        
        this.swap = await LimitOrderProtocol.new();

        this.chainId = await this.dai.getChainId();

        await this.dai.mint(wallet, ether('1000000'));
        await this.weth.mint(wallet, ether('1000000'));
        await this.inch.mint(wallet, ether('1000000'));
        await this.dai.mint(_, ether('1000000'));
        await this.weth.mint(_, ether('1000000'));
        await this.inch.mint(_, ether('1000000'));
        await this.ticketNFT.mint(wallet, 10);
        // await this.ticketNFT.safeMint(wallet, '1');
        // await this.ticketNFT.safeMint(wallet, '2');
        // await this.ticketNFT.safeMint(wallet, '3');
        // await this.ticketNFT.safeMint(wallet, '4');
        // await this.ticketNFT.safeMint(wallet, '5');
        // await this.ticketNFT.safeMint(wallet, '6');
        // await this.ticketNFT.safeMint(wallet, '7');
        // await this.ticketNFT.safeMint(wallet, '8');
        // await this.ticketNFT.safeMint(wallet, '9');
        // await this.ticketNFT.safeMint(wallet, '10');
        const balance = await this.ticketNFT.balanceOf(wallet);
        console.log('Issued ' + balance + ' NFT tickets');

        await this.dai.approve(this.swap.address, ether('1000000'));
        await this.weth.approve(this.swap.address, ether('1000000'));
        await this.inch.approve(this.swap.address, ether('1000000'));
        await this.ticketNFT.approve(this.swap.address, 10);
        // await this.ticketNFT.setApprovalForAll(this.swap.address, true);
        await this.dai.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.weth.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.inch.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.ticketNFT.approve(this.swap.address, 10, { from: wallet });

        this.daiOracle = await AggregatorMock.new(ether('0.00025'));
    });

    // Purchase of ticket ( Filled 2 orders)
    xit('NFT sell', async function () {
        const makerTicketNFT = await this.ticketNFT.balanceOf(wallet);
        const takerTicketNFT = await this.ticketNFT.balanceOf(_);
        const makerWeth = await this.weth.balanceOf(wallet);
        const takerWeth = await this.weth.balanceOf(_);
        console.log('Balances: %s %s %s %s', makerTicketNFT, takerTicketNFT, makerWeth, takerWeth);

        for (i = 0; i < 2; i++) {
            console.log('enter');
            const order = buildOrder(
                i.toString(), this.ticketNFT, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x',
            );
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await this.swap.fillOrder(order, signature, 0, ether('1000'), 1);
            console.log('filled order');
        }
        const makerTicketNFT1 = await this.ticketNFT.balanceOf(wallet);
        const takerTicketNFT1 = await this.ticketNFT.balanceOf(_);
        const makerWeth1 = await this.weth.balanceOf(wallet);
        const takerWeth1 = await this.weth.balanceOf(_);
        console.log('Balances: %d %d %d %d', makerTicketNFT1, takerTicketNFT1, makerWeth1 / 10 ** 18, takerWeth1 / 10 ** 18);

        expect(await this.ticketNFT.balanceOf(wallet)).to.be.bignumber.equal(makerTicketNFT.sub(web3.utils.toBN('2')));
        expect(await this.ticketNFT.balanceOf(_)).to.be.bignumber.equal(takerTicketNFT.add(web3.utils.toBN('2')));
        expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('2000')));
        expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('2000')));
    });

    // Ticket made for specific buyer ( allowedSender )
    describe('VIP ticket', async function () {
        xit('should fill with correct taker', async function () {
            const order = buildOrder(
                '1', this.ticketNFT, this.weth, '1'.toString(), '1'.toString(), '0x', '0x',
            );
            order.allowedSender = _;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            const makerTicketNFT = await this.ticketNFT.balanceOf(wallet);
            const takerTicketNFT = await this.ticketNFT.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);
            console.log('Balances: %s %s %s %s', makerTicketNFT, takerTicketNFT, makerWeth, takerWeth);

            await this.swap.fillOrder(order, signature, 0, 1, 1);

            expect(await this.ticketNFT.balanceOf(wallet)).to.be.bignumber.equal(makerTicketNFT.sub(web3.utils.toBN('1')));
            expect(await this.ticketNFT.balanceOf(_)).to.be.bignumber.equal(takerTicketNFT.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(web3.utils.toBN('1')));
        });

        it('should not fill with incorrect taker', async function () {
            const order = buildOrder(
                '1', this.ticketNFT, this.weth, '1'.toString(), '1'.toString(), '0x', '0x',
            );
            order.allowedSender = wallet;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 0, 1, 1),
                'LOP: private order',
            );
        });
    });

    // Variable price depending on the market conditions ( getTakerAmount )
    xit('Ticket price protection', async function () {
        const makerAmount = 1;
        const takerAmount = ether('1');
        const order = buildOrder(
            '1', this.ticketNFT, this.weth, '1'.toString(), ether('1').toString(), '0x',
            cutLastArg(this.swap.contract.methods.getTakerAmount(makerAmount, takerAmount, 0).encodeABI()),
        );

        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        const makerTicketNFT = await this.ticketNFT.balanceOf(wallet);
        const takerTicketNFT = await this.ticketNFT.balanceOf(_);
        const makerWeth = await this.weth.balanceOf(wallet);
        const takerWeth = await this.weth.balanceOf(_);

        await this.swap.fillOrder(order, signature, makerAmount, 0, takerAmount.add(ether('0.01')));
        console.log('filled order');

        const makerTicketNFT1 = await this.ticketNFT.balanceOf(wallet);
        const takerTicketNFT1 = await this.ticketNFT.balanceOf(_);
        const makerWeth1 = await this.weth.balanceOf(wallet);
        const takerWeth1 = await this.weth.balanceOf(_);
        console.log('Balances: %d %d %d %d', makerTicketNFT1, takerTicketNFT1, makerWeth1, takerWeth1);

        expect(await this.ticketNFT.balanceOf(wallet)).to.be.bignumber.equal(makerTicketNFT.sub(web3.utils.toBN('1')));
        expect(await this.ticketNFT.balanceOf(_)).to.be.bignumber.equal(takerTicketNFT.add(web3.utils.toBN('1')));
        expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether(makerAmount.toString())));
        expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether(makerAmount.toString())));
    });

    // Sale expiration ( Predicate )
    describe('Ticket sale finish', async function () {
        xit('should sell when not finished', async function () {

            const order = buildOrder(
                '1', this.ticketNFT, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x', constants.ZERO_ADDRESS, 
                this.swap.contract.methods.timestampBelow(0xff00000000).encodeABI(),
            );
    
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });
    
            const makerTicketNFT = await this.ticketNFT.balanceOf(wallet);
            const takerTicketNFT = await this.ticketNFT.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);
            console.log('Balances: %s %s %s %s', makerTicketNFT, takerTicketNFT, makerWeth, takerWeth);
    
            await this.swap.fillOrder(order, signature, 0, ether('1000'), 1);
            console.log("fill order");
            const makerTicketNFT1 = await this.ticketNFT.balanceOf(wallet);
            const takerTicketNFT1 = await this.ticketNFT.balanceOf(_);
            const makerWeth1 = await this.weth.balanceOf(wallet);
            const takerWeth1 = await this.weth.balanceOf(_);
            console.log('Balances: %d %d %d %d', makerTicketNFT1, takerTicketNFT1, makerWeth1 / 10 ** 18, takerWeth1 / 10 ** 18);
    
            expect(await this.ticketNFT.balanceOf(wallet)).to.be.bignumber.equal(makerTicketNFT.sub(web3.utils.toBN('1')));
            expect(await this.ticketNFT.balanceOf(_)).to.be.bignumber.equal(takerTicketNFT.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('1000')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('1000')));
        });

        xit('should not sell when finished', async function () {
            const order = buildOrder(
                '1', this.ticketNFT, this.weth, '1'.toString(), ether('1000').toString(), '0x', '0x', constants.ZERO_ADDRESS, 
                this.swap.contract.methods.timestampBelow(0xff0000).encodeABI()
            );
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 0, ether('1000'), 1),
                'LOP: predicate returned false',
            );
        });
    });

    xit('White list gets discount', async function () {
        const makerAmount = ether('100');
        const takerAmount = ether('631');
        const priceCall = buildDoublePriceGetter(this.swap, this.inchOracle, this.daiOracle, '1000000000', ether('1'));
        const predicate = this.swap.contract.methods.lt(ether('6.32'), this.swap.address, priceCall).encodeABI();

        const order = buildOrder(
            '1', this.inch, this.dai, makerAmount.toString(), takerAmount.toString(),
            cutLastArg(this.swap.contract.methods.getMakerAmount(makerAmount, takerAmount, 0).encodeABI()),
            cutLastArg(this.swap.contract.methods.getTakerAmount(makerAmount, takerAmount, 0).encodeABI()),
            constants.ZERO_ADDRESS,
            predicate,
        );
        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        const makerDai = await this.dai.balanceOf(wallet);
        const takerDai = await this.dai.balanceOf(_);
        const makerInch = await this.inch.balanceOf(wallet);
        const takerInch = await this.inch.balanceOf(_);

        await this.swap.fillOrder(order, signature, makerAmount, 0, takerAmount.add(ether('0.01'))); // taking threshold = exact taker amount + eps

        expect(await this.dai.balanceOf(wallet)).to.be.bignumber.equal(makerDai.add(takerAmount));
        expect(await this.dai.balanceOf(_)).to.be.bignumber.equal(takerDai.sub(takerAmount));
        expect(await this.inch.balanceOf(wallet)).to.be.bignumber.equal(makerInch.sub(makerAmount));
        expect(await this.inch.balanceOf(_)).to.be.bignumber.equal(takerInch.add(makerAmount));
    });

    xit('dai -> 1inch stop loss order predicate is invalid', async function () {
        const makerAmount = ether('100');
        const takerAmount = ether('631');
        const priceCall = buildDoublePriceGetter(this.swap, this.inchOracle, this.daiOracle, '1000000000', ether('1'));
        const predicate = this.swap.contract.methods.lt(ether('6.31'), this.swap.address, priceCall).encodeABI();

        const order = buildOrder(
            '1', this.inch, this.dai, makerAmount.toString(), takerAmount.toString(),
            cutLastArg(this.swap.contract.methods.getMakerAmount(makerAmount, takerAmount, 0).encodeABI()),
            cutLastArg(this.swap.contract.methods.getTakerAmount(makerAmount, takerAmount, 0).encodeABI()),
            constants.ZERO_ADDRESS,
            predicate,
        );
        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        await expectRevert(
            this.swap.fillOrder(order, signature, makerAmount, 0, takerAmount.add(ether('0.01'))), // taking threshold = exact taker amount + eps
            'LOP: predicate returned false',
        );
    });
});
